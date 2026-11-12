"""Security regression tests for Motion.

Run from the Motion folder:  python -m pytest tests/
Each test gets a fresh temporary SQLite file (via MOTION_DB) and a reset rate limiter.
"""
import hashlib
import os
import re
import sqlite3
import stat
import sys
import tempfile
import time

import pytest

# Must be set before app.py is imported: it reads these at import time.
_TMP_DIR = tempfile.mkdtemp(prefix='motion-tests-')
os.environ['MOTION_DB'] = os.path.join(_TMP_DIR, 'import.db')
os.environ['SECRET_KEY'] = 'test-secret-key-not-for-production'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as motion  # noqa: E402
from database import Database  # noqa: E402
from flask import Flask  # noqa: E402
from flask.sessions import SecureCookieSessionInterface  # noqa: E402

PASSWORD = 'Str0ng!Pass'
XSS = '<script>alert("x")</script>'


@pytest.fixture(autouse=True)
def fresh_app(tmp_path):
    motion.db = Database(str(tmp_path / 'test.db'))
    motion.app.config['TESTING'] = True
    motion.limiter.enabled = True
    motion.limiter.reset()
    yield
    motion.limiter.reset()


def new_client():
    return motion.app.test_client()


# Helpers ---------------------------------------------------------------

def csrf_token(client):
    """The CSRF token in the client's session (rendering a page creates it)."""
    with client.session_transaction() as s:
        token = s.get('csrf_token')
    if token:
        return token
    html = client.get('/login').get_data(as_text=True)
    match = re.search(r'<meta name="csrf-token" content="([0-9a-f]+)">', html)
    assert match, 'csrf meta tag missing from login page'
    return match.group(1)


def call(client, method, url, json=None, token=True, **kwargs):
    headers = kwargs.pop('headers', {})
    if token:
        headers['X-CSRF-Token'] = csrf_token(client)
    return client.open(url, method=method, json=json, headers=headers, **kwargs)


def register(client, email, name='User', password=PASSWORD):
    resp = call(client, 'POST', '/register',
                json={'email': email, 'name': name, 'password': password})
    assert resp.status_code == 200, resp.get_json()
    with client.session_transaction() as s:
        return s['user_id']


def login(client, email, password=PASSWORD):
    return call(client, 'POST', '/login', json={'email': email, 'password': password})


def is_redirect_to_landing(resp):
    return resp.status_code == 302 and resp.headers['Location'].endswith('/')


# Authentication --------------------------------------------------------

PROTECTED_GETS = [
    '/dashboard', '/page/1', '/database/1', '/chat', '/chat/1',
    '/api/pages', '/api/pages/1', '/api/databases', '/api/databases/1',
    '/api/items/1', '/api/chats', '/api/chats/1/messages', '/api/search?q=a',
    '/api/export/1',
]

PROTECTED_WRITES = [
    ('POST', '/api/pages'), ('PUT', '/api/pages/1'), ('DELETE', '/api/pages/1'),
    ('POST', '/api/pages/1/tags'), ('POST', '/api/databases'),
    ('PUT', '/api/databases/1'), ('DELETE', '/api/databases/1'),
    ('POST', '/api/databases/1/items'), ('PUT', '/api/items/1'),
    ('DELETE', '/api/items/1'), ('POST', '/api/databases/1/properties'),
    ('DELETE', '/api/properties/1'), ('POST', '/api/databases/1/filter'),
    ('POST', '/api/chats'), ('POST', '/api/chats/1/messages'),
    ('POST', '/api/ai/improve'),
]


@pytest.mark.parametrize('url', PROTECTED_GETS)
def test_protected_get_routes_redirect_without_login(url):
    assert is_redirect_to_landing(new_client().get(url))


@pytest.mark.parametrize('method,url', PROTECTED_WRITES)
def test_protected_write_routes_redirect_without_login(method, url):
    # Valid CSRF token, but no logged-in user
    assert is_redirect_to_landing(call(new_client(), method, url, json={}))


def test_forged_session_cookie_is_rejected():
    client = new_client()
    client.set_cookie('session', 'eyJ1c2VyX2lkIjoxfQ.forged.signature')
    assert is_redirect_to_landing(client.get('/dashboard'))


def test_session_signed_with_wrong_key_is_rejected():
    victim = new_client()
    user_id = register(victim, 'victim@example.com')

    attacker_app = Flask('attacker')
    attacker_app.secret_key = 'motion-secret-key-2025'  # the old hardcoded default
    serializer = SecureCookieSessionInterface().get_signing_serializer(attacker_app)
    forged = serializer.dumps({'user_id': user_id, 'session_version': 0,
                               'login_at': int(time.time())})

    attacker = new_client()
    attacker.set_cookie('session', forged)
    assert is_redirect_to_landing(attacker.get('/dashboard'))


def test_tampered_session_cookie_is_rejected():
    client = new_client()
    register(client, 'tamper@example.com')
    cookie = client.get_cookie('session').value
    payload, rest = cookie.split('.', 1)
    tampered = payload[:-2] + ('AA' if payload[-2:] != 'AA' else 'BB') + '.' + rest

    other = new_client()
    other.set_cookie('session', tampered)
    assert is_redirect_to_landing(other.get('/dashboard'))


def test_session_version_mismatch_logs_user_out():
    client = new_client()
    user_id = register(client, 'version@example.com')
    assert client.get('/dashboard').status_code == 200

    motion.db.bump_session_version(user_id)

    assert is_redirect_to_landing(client.get('/dashboard'))
    with client.session_transaction() as s:
        assert 'user_id' not in s


def test_logout_is_post_only_and_revokes_copied_cookie():
    client = new_client()
    register(client, 'logout@example.com')
    stolen = client.get_cookie('session').value

    assert client.get('/logout').status_code == 405
    assert call(client, 'POST', '/logout').status_code == 302

    thief = new_client()
    thief.set_cookie('session', stolen)
    assert is_redirect_to_landing(thief.get('/dashboard'))


def test_expired_session_is_rejected():
    client = new_client()
    register(client, 'expired@example.com')
    with client.session_transaction() as s:
        s['login_at'] = int(time.time()) - 9 * 3600
    assert is_redirect_to_landing(client.get('/dashboard'))


def test_session_cookie_flags():
    client = new_client()
    resp = call(client, 'POST', '/register',
                json={'email': 'flags@example.com', 'name': 'F', 'password': PASSWORD})
    cookie = resp.headers['Set-Cookie']
    assert 'HttpOnly' in cookie
    assert 'SameSite=Lax' in cookie
    assert 'Expires=' in cookie


# Passwords -------------------------------------------------------------

def test_login_error_is_identical_for_unknown_email_and_wrong_password():
    register(new_client(), 'known@example.com')
    wrong_pw = login(new_client(), 'known@example.com', 'Wrong!Pass1')
    no_user = login(new_client(), 'nobody@example.com', 'Wrong!Pass1')
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.get_json() == no_user.get_json()


def test_legacy_password_hash_still_works_and_is_upgraded():
    salt = os.urandom(32)
    legacy = salt + hashlib.pbkdf2_hmac('sha256', PASSWORD.encode(), salt, 100000)
    conn = sqlite3.connect(motion.db.db_name)
    conn.execute('INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
                 ('legacy@example.com', legacy, 'Legacy'))
    conn.commit()
    conn.close()

    assert login(new_client(), 'legacy@example.com').status_code == 200

    stored = motion.db.get_user_by_email('legacy@example.com')['password']
    assert isinstance(stored, str) and '$' in stored  # werkzeug format now
    assert login(new_client(), 'legacy@example.com').status_code == 200
    assert login(new_client(), 'legacy@example.com', 'Wrong!Pass1').status_code == 401


def test_new_passwords_use_werkzeug_hash():
    register(new_client(), 'hash@example.com')
    stored = motion.db.get_user_by_email('hash@example.com')['password']
    assert isinstance(stored, str) and stored.split(':')[0] in ('scrypt', 'pbkdf2')


# Rate limiting ---------------------------------------------------------

def test_login_rate_limit_returns_429():
    client = new_client()
    for i in range(5):
        resp = login(client, f'nobody{i}@example.com', 'Wrong!Pass1')
        assert resp.status_code == 401
    resp = login(client, 'nobody9@example.com', 'Wrong!Pass1')
    assert resp.status_code == 429
    assert 'error' in resp.get_json()


def test_failed_logins_lock_the_email():
    register(new_client(), 'locked@example.com')
    motion.limiter.enabled = False  # isolate the per-email lock from the per-IP limit
    for _ in range(5):
        assert login(new_client(), 'locked@example.com', 'Wrong!Pass1').status_code == 401
    # Even the correct password is refused while locked
    resp = login(new_client(), 'locked@example.com')
    assert resp.status_code == 429
    assert 'error' in resp.get_json()


def test_register_rate_limit_returns_429():
    client = new_client()
    for i in range(10):
        resp = call(client, 'POST', '/register', json={'email': 'bad', 'name': 'x', 'password': 'x'})
        assert resp.status_code == 400
    resp = call(client, 'POST', '/register', json={'email': 'bad', 'name': 'x', 'password': 'x'})
    assert resp.status_code == 429


# CSRF ------------------------------------------------------------------

def test_wrong_or_missing_csrf_token_gives_403():
    client = new_client()
    register(client, 'csrf@example.com')

    wrong = client.post('/api/pages', json={'title': 'x'}, headers={'X-CSRF-Token': '0' * 64})
    assert wrong.status_code == 403
    assert 'error' in wrong.get_json()

    missing = client.post('/api/pages', json={'title': 'x'})
    assert missing.status_code == 403

    assert call(client, 'POST', '/api/pages', json={'title': 'x'}).status_code == 200


def test_login_requires_csrf_token():
    resp = new_client().post('/login', json={'email': 'a@example.com', 'password': 'x'})
    assert resp.status_code == 403


def test_csrf_meta_tag_on_every_page():
    client = new_client()
    for url in ('/', '/login', '/register'):
        assert 'name="csrf-token"' in client.get(url).get_data(as_text=True)
    register(client, 'meta@example.com')
    page_id = call(client, 'POST', '/api/pages', json={}).get_json()['id']
    db_id = call(client, 'POST', '/api/databases', json={}).get_json()['id']
    chat_id = call(client, 'POST', '/api/chats', json={}).get_json()['id']
    for url in ('/dashboard', f'/page/{page_id}', f'/database/{db_id}', f'/chat/{chat_id}'):
        assert 'name="csrf-token"' in client.get(url).get_data(as_text=True)


# Authorization (IDOR) --------------------------------------------------

@pytest.fixture
def two_users():
    alice, bob = new_client(), new_client()
    register(alice, 'alice@example.com', 'Alice')
    register(bob, 'bob@example.com', 'Bob')

    page_id = call(alice, 'POST', '/api/pages', json={'title': 'Alice page', 'content': 'secret'}).get_json()['id']
    db_id = call(alice, 'POST', '/api/databases', json={'title': 'Alice db'}).get_json()['id']
    item_id = call(alice, 'POST', f'/api/databases/{db_id}/items',
                   json={'properties': {'Name': 'Alice item'}}).get_json()['id']
    prop_id = call(alice, 'POST', f'/api/databases/{db_id}/properties',
                   json={'name': 'Email', 'type': 'email'}).get_json()['id']
    chat_id = call(alice, 'POST', '/api/chats', json={'title': 'Alice chat'}).get_json()['id']
    motion.db.add_chat_message(chat_id, 'user', 'alice secret message')
    return alice, bob, dict(page=page_id, db=db_id, item=item_id, prop=prop_id, chat=chat_id)


def test_other_user_cannot_touch_resources(two_users):
    alice, bob, ids = two_users
    p, d, i, pr, c = ids['page'], ids['db'], ids['item'], ids['prop'], ids['chat']
    attempts = [
        ('GET', f'/api/pages/{p}', None),
        ('PUT', f'/api/pages/{p}', {'title': 'pwned'}),
        ('DELETE', f'/api/pages/{p}', None),
        ('POST', f'/api/pages/{p}/tags', {'tags': ['pwned']}),
        ('GET', f'/api/export/{p}', None),
        ('GET', f'/api/databases/{d}', None),
        ('PUT', f'/api/databases/{d}', {'title': 'pwned'}),
        ('DELETE', f'/api/databases/{d}', None),
        ('POST', f'/api/databases/{d}/items', {'properties': {'Name': 'pwned'}}),
        ('POST', f'/api/databases/{d}/properties', {'name': 'pwned'}),
        ('POST', f'/api/databases/{d}/filter', {'filters': []}),
        ('GET', f'/api/items/{i}', None),
        ('PUT', f'/api/items/{i}', {'properties': {'Name': 'pwned'}}),
        ('DELETE', f'/api/items/{i}', None),
        ('DELETE', f'/api/properties/{pr}', None),
        ('GET', f'/api/chats/{c}/messages', None),
        ('POST', f'/api/chats/{c}/messages', {'message': 'hi'}),
    ]
    for method, url, body in attempts:
        resp = call(bob, method, url, json=body)
        assert resp.status_code == 404, (method, url, resp.status_code)

    # HTML views redirect away instead of showing Alice's data
    for url in (f'/page/{p}', f'/database/{d}', f'/chat/{c}'):
        resp = bob.get(url)
        assert resp.status_code == 302, url

    # Bob's listings and search don't include Alice's things
    assert call(bob, 'GET', '/api/pages').get_json() == []
    assert call(bob, 'GET', '/api/databases').get_json() == []
    assert call(bob, 'GET', '/api/search?q=Alice').get_json() == []

    # Alice's data is untouched
    page = call(alice, 'GET', f'/api/pages/{p}').get_json()
    assert page['title'] == 'Alice page' and page['content'] == 'secret'
    data = call(alice, 'GET', f'/api/databases/{d}').get_json()
    assert data['database']['title'] == 'Alice db'
    assert any(prop['id'] == pr for prop in data['properties'])
    assert [it['properties']['Name'] for it in data['items']] == ['Alice item']
    assert len(call(alice, 'GET', f'/api/chats/{c}/messages').get_json()) == 1


# Foreign keys / deletes ------------------------------------------------

def test_delete_page_and_database_cascade():
    client = new_client()
    register(client, 'fk@example.com')
    page_id = call(client, 'POST', '/api/pages', json={}).get_json()['id']
    call(client, 'POST', f'/api/pages/{page_id}/tags', json={'tags': ['a', 'b']})
    db_id = call(client, 'POST', '/api/databases', json={}).get_json()['id']
    call(client, 'POST', f'/api/databases/{db_id}/items', json={'properties': {'Name': 'x'}})

    assert call(client, 'DELETE', f'/api/pages/{page_id}').get_json() == {'success': True}
    assert call(client, 'DELETE', f'/api/databases/{db_id}').get_json() == {'success': True}

    conn = sqlite3.connect(motion.db.db_name)
    assert conn.execute('SELECT COUNT(*) FROM page_tags').fetchone()[0] == 0
    assert conn.execute('SELECT COUNT(*) FROM database_items').fetchone()[0] == 0
    assert conn.execute('SELECT COUNT(*) FROM database_properties').fetchone()[0] == 0
    conn.close()


def test_foreign_keys_enabled_on_connections():
    conn = motion.db.get_connection()
    assert conn.execute('PRAGMA foreign_keys').fetchone()[0] == 1
    conn.close()


def test_existing_db_gets_session_version_column(tmp_path):
    path = str(tmp_path / 'old.db')
    conn = sqlite3.connect(path)
    conn.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, '
                 'password BLOB NOT NULL, name TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
    conn.execute("INSERT INTO users (email, password, name) VALUES ('old@example.com', x'00', 'Old')")
    conn.commit()
    conn.close()

    migrated = Database(path)
    assert migrated.get_session_version(1) == 0


# XSS -------------------------------------------------------------------

def test_xss_in_titles_is_escaped():
    client = new_client()
    register(client, 'xss@example.com', name=XSS[:50])
    page_id = call(client, 'POST', '/api/pages', json={'title': XSS, 'content': XSS}).get_json()['id']
    call(client, 'POST', f'/api/pages/{page_id}/tags', json={'tags': ['<img src=x onerror=alert(1)>']})
    db_id = call(client, 'POST', '/api/databases', json={'title': XSS}).get_json()['id']
    call(client, 'POST', f'/api/databases/{db_id}/properties', json={'name': XSS, 'type': 'text'})
    call(client, 'POST', f'/api/databases/{db_id}/items', json={'properties': {'Name': XSS}})
    chat_id = call(client, 'POST', '/api/chats', json={'title': XSS}).get_json()['id']

    for url in ('/dashboard', f'/page/{page_id}', f'/database/{db_id}', f'/chat/{chat_id}'):
        html = client.get(url).get_data(as_text=True)
        assert XSS not in html, url
        assert '<img src=x' not in html, url
        assert '&lt;script&gt;' in html or '\\u003cscript\\u003e' in html, url

    # JSON API responses are served as JSON, never HTML
    resp = call(client, 'GET', f'/api/pages/{page_id}')
    assert resp.mimetype == 'application/json'


def test_export_filename_is_sanitized():
    client = new_client()
    register(client, 'export@example.com')
    page_id = call(client, 'POST', '/api/pages', json={'title': 'a"b\\..\\/c'}).get_json()['id']
    disposition = client.get(f'/api/export/{page_id}').headers['Content-Disposition']
    assert disposition == 'attachment; filename="a_b_..__c.md"'


# Headers ---------------------------------------------------------------

def test_security_headers():
    client = new_client()
    resp = client.get('/')
    assert resp.headers['X-Content-Type-Options'] == 'nosniff'
    assert resp.headers['X-Frame-Options'] == 'DENY'
    assert resp.headers['Referrer-Policy'] == 'no-referrer'
    assert 'camera=()' in resp.headers['Permissions-Policy']
    csp = resp.headers['Content-Security-Policy']
    assert "script-src 'self'" in csp and 'unsafe-inline' not in csp
    assert 'no-store' not in resp.headers.get('Cache-Control', '')

    register(client, 'headers@example.com')
    assert client.get('/dashboard').headers['Cache-Control'] == 'no-store'


def test_templates_have_no_inline_scripts_or_handlers():
    templates = os.path.join(os.path.dirname(motion.__file__), 'templates')
    for name in os.listdir(templates):
        if not name.endswith('.html'):
            continue
        with open(os.path.join(templates, name)) as f:
            html = f.read()
        assert not re.search(r'\son[a-z]+\s*=', html), name
        assert not re.search(r'\sstyle\s*=', html), name
        # Only <script src=...> or non-executable JSON data blocks
        for tag in re.findall(r'<script[^>]*>', html):
            assert 'src=' in tag or 'type="application/json"' in tag, (name, tag)


# Input validation ------------------------------------------------------

def test_non_json_body_returns_400():
    client = new_client()
    register(client, 'json@example.com')
    resp = call(client, 'POST', '/api/pages', data='not json', content_type='text/plain')
    assert resp.status_code == 400
    assert 'error' in resp.get_json()
    resp = call(client, 'POST', '/api/pages', data='[1, 2]', content_type='application/json')
    assert resp.status_code == 400


def test_wrong_types_and_lengths_return_400():
    client = new_client()
    register(client, 'len@example.com')
    assert call(client, 'POST', '/api/pages', json={'title': 123}).status_code == 400
    assert call(client, 'POST', '/api/pages', json={'title': 'x' * 201}).status_code == 400
    page_id = call(client, 'POST', '/api/pages', json={}).get_json()['id']
    assert call(client, 'POST', f'/api/pages/{page_id}/tags', json={'tags': ['x' * 51]}).status_code == 400
    assert call(client, 'POST', f'/api/pages/{page_id}/tags', json={'tags': 'abc'}).status_code == 400
    chat_id = call(client, 'POST', '/api/chats', json={}).get_json()['id']
    assert call(client, 'POST', f'/api/chats/{chat_id}/messages',
                json={'message': 'x' * 4001}).status_code == 400
    db_id = call(client, 'POST', '/api/databases', json={}).get_json()['id']
    assert call(client, 'POST', f'/api/databases/{db_id}/properties',
                json={'name': 'p', 'type': 'script'}).status_code == 400


def test_register_validates_email_and_name():
    client = new_client()
    bad_email = call(client, 'POST', '/register', json={'email': 'nope', 'name': 'N', 'password': PASSWORD})
    assert bad_email.status_code == 400
    long_name = call(client, 'POST', '/register',
                     json={'email': 'n@example.com', 'name': 'x' * 101, 'password': PASSWORD})
    assert long_name.status_code == 400


def test_body_over_1mb_returns_413():
    client = new_client()
    register(client, 'big@example.com')
    resp = call(client, 'POST', '/api/pages', json={'content': 'x' * (1024 * 1024 + 10)})
    assert resp.status_code == 413


# Secret key ------------------------------------------------------------

def test_secret_key_file_is_created_private_and_reused(tmp_path, monkeypatch):
    key_file = tmp_path / '.secret_key'
    monkeypatch.setattr(motion, 'SECRET_KEY_FILE', str(key_file))
    monkeypatch.delenv('SECRET_KEY', raising=False)

    first = motion.load_secret_key()
    assert len(first) == 64
    assert stat.S_IMODE(os.stat(key_file).st_mode) == 0o600
    assert motion.load_secret_key() == first

    monkeypatch.setenv('SECRET_KEY', 'from-env')
    assert motion.load_secret_key() == 'from-env'


def test_page_scripts_load_after_main_js():
    # chat.js / database.js read motionData from main.js, so they must come after it
    client = new_client()
    register(client, 'order@example.com')
    db_id = call(client, 'POST', '/api/databases', json={}).get_json()['id']
    chat_id = call(client, 'POST', '/api/chats', json={}).get_json()['id']
    for url, script in ((f'/database/{db_id}', 'js/database.js'), (f'/chat/{chat_id}', 'js/chat.js')):
        html = client.get(url).get_data(as_text=True)
        assert html.index('js/csrf.js') < html.index('js/main.js') < html.index(script), url
