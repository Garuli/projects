"""Tests for the forgot-password / reset-password / change-password flow.

Run from the Motion folder:  python -m pytest tests/
Each test gets a fresh temporary SQLite file (via MOTION_DB), a reset rate
limiter, a fake mailer that records messages instead of sending them, and
background work run inline so results are deterministic.
"""
import hashlib
import logging
import os
import re
import secrets
import sqlite3
import sys
import tempfile
import time

import pytest

# Must be set before app.py is imported: it reads these at import time.
_TMP_DIR = tempfile.mkdtemp(prefix='motion-tests-')
os.environ.setdefault('MOTION_DB', os.path.join(_TMP_DIR, 'import.db'))
os.environ.setdefault('SECRET_KEY', 'test-secret-key-not-for-production')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as motion  # noqa: E402
import mailer  # noqa: E402
from database import Database  # noqa: E402

REAL_SEND_MAIL = mailer.send_mail  # saved before the outbox fixture replaces it

PASSWORD = 'Str0ng!Pass'
NEW_PASSWORD = 'N3w!Passw0rd'
EMAIL = 'reset@example.com'
GENERIC_MESSAGE = "If an account exists for that email, we've sent a reset link."
LINK_RE = re.compile(r'(https?://\S+/reset-password/([A-Za-z0-9_-]+))')


@pytest.fixture(autouse=True)
def fresh_app(tmp_path, monkeypatch):
    motion.db = Database(str(tmp_path / 'test.db'))
    motion.app.config['TESTING'] = True
    motion.limiter.enabled = True
    motion.limiter.reset()
    monkeypatch.delenv('APP_BASE_URL', raising=False)
    yield
    motion.limiter.reset()


@pytest.fixture(autouse=True)
def outbox(monkeypatch):
    """Record emails instead of sending them; run background work inline."""
    sent = []

    def fake_send_mail(to, subject, text, html=None):
        sent.append({'to': to, 'subject': subject, 'text': text, 'html': html})
        return True

    monkeypatch.setattr(motion.mailer, 'send_mail', fake_send_mail)
    monkeypatch.setattr(motion, 'run_in_background', lambda func, *args: func(*args))
    return sent


# Helpers ---------------------------------------------------------------

def new_client():
    return motion.app.test_client()


def csrf_token(client):
    with client.session_transaction() as s:
        token = s.get('csrf_token')
    if token:
        return token
    html = client.get('/login').get_data(as_text=True)
    return re.search(r'<meta name="csrf-token" content="([0-9a-f]+)">', html).group(1)


def call(client, method, url, json=None, **kwargs):
    headers = kwargs.pop('headers', {})
    headers['X-CSRF-Token'] = csrf_token(client)
    return client.open(url, method=method, json=json, headers=headers, **kwargs)


def register(client, email=EMAIL, password=PASSWORD):
    resp = call(client, 'POST', '/register', json={'email': email, 'name': 'Reset User', 'password': password})
    assert resp.status_code == 200, resp.get_json()
    with client.session_transaction() as s:
        return s['user_id']


def create_user(email=EMAIL, password=PASSWORD):
    return motion.db.create_user(email, password, 'Reset User')


def login(client, email=EMAIL, password=PASSWORD):
    return call(client, 'POST', '/login', json={'email': email, 'password': password})


def request_reset(client=None, email=EMAIL, **kwargs):
    return call(client or new_client(), 'POST', '/forgot-password', json={'email': email}, **kwargs)


def spoofed_request_reset(base_url, headers=None):
    """POST /forgot-password with a forged Host (cookies are per host, so get the CSRF token there too)."""
    client = new_client()
    html = client.get('/forgot-password', base_url=base_url).get_data(as_text=True)
    token = re.search(r'<meta name="csrf-token" content="([0-9a-f]+)">', html).group(1)
    resp = client.post('/forgot-password', json={'email': EMAIL}, base_url=base_url,
                       headers={'X-CSRF-Token': token, **(headers or {})})
    assert resp.status_code == 200
    return resp


def reset_emails(outbox):
    return [m for m in outbox if m['subject'] == 'Reset your Motion password']


def last_reset_token(outbox):
    match = LINK_RE.search(reset_emails(outbox)[-1]['text'])
    assert match, 'no reset link in email'
    return match.group(2)


def get_token(outbox, email=EMAIL):
    assert request_reset(email=email).status_code == 200
    return last_reset_token(outbox)


def submit_reset(token, password=NEW_PASSWORD, client=None):
    return call(client or new_client(), 'POST', f'/reset-password/{token}', json={'password': password})


def reset_rows():
    conn = sqlite3.connect(motion.db.db_name)
    conn.row_factory = sqlite3.Row
    rows = [dict(r) for r in conn.execute('SELECT * FROM password_resets')]
    conn.close()
    return rows


def is_invalid_page(resp):
    return resp.status_code == 400 and 'invalid or has expired' in resp.get_data(as_text=True)


# Requesting a reset ----------------------------------------------------

def test_same_response_for_existing_and_unknown_email(outbox):
    create_user()
    known = request_reset(email=EMAIL)
    unknown = request_reset(email='nobody@example.com')
    assert known.status_code == unknown.status_code == 200
    assert known.get_json() == unknown.get_json() == {'success': True, 'message': GENERIC_MESSAGE}
    assert known.get_data() == unknown.get_data()
    # Only the real account got an email
    assert [m['to'] for m in reset_emails(outbox)] == [EMAIL]


def test_email_is_case_insensitive(outbox):
    create_user()
    request_reset(email='  RESET@Example.com ')
    assert len(reset_emails(outbox)) == 1


def test_work_happens_in_background(monkeypatch):
    # The request thread only queues the work: no DB lookup, no email
    queued = []
    monkeypatch.setattr(motion, 'run_in_background', lambda func, *args: queued.append((func, args)))
    create_user()
    assert request_reset().status_code == 200
    assert queued == [(motion.process_reset_request, (EMAIL,))]
    assert reset_rows() == []


def test_invalid_email_is_rejected():
    assert request_reset(email='not-an-email').status_code == 400


def test_token_is_stored_only_as_sha256_hash(outbox):
    create_user()
    token = get_token(outbox)
    rows = reset_rows()
    assert len(rows) == 1
    assert rows[0]['token_hash'] == hashlib.sha256(token.encode()).hexdigest()
    assert token not in repr(rows)
    with open(motion.db.db_name, 'rb') as f:
        assert token.encode() not in f.read()


def test_token_expires_in_30_minutes(outbox):
    create_user()
    get_token(outbox)
    row = reset_rows()[0]
    assert row['expires_at'] - row['created_at'] == pytest.approx(30 * 60)
    assert row['used_at'] is None


def test_second_request_invalidates_first_token(outbox):
    create_user()
    first = get_token(outbox)
    second = get_token(outbox)
    assert first != second
    assert len(reset_rows()) == 1
    assert is_invalid_page(new_client().get(f'/reset-password/{first}'))
    assert submit_reset(first).status_code == 400
    assert submit_reset(second).status_code == 200


def test_stale_tokens_are_deleted_on_any_request(outbox):
    other = create_user('other@example.com')
    expired = time.time() - 10
    conn = sqlite3.connect(motion.db.db_name)
    conn.execute('INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
                 (other, 'a' * 64, expired - 1800, expired))
    conn.execute('INSERT INTO password_resets (user_id, token_hash, created_at, expires_at, used_at) '
                 'VALUES (?, ?, ?, ?, ?)', (other, 'b' * 64, time.time(), time.time() + 1800, time.time()))
    conn.commit()
    conn.close()
    request_reset(email='nobody@example.com')
    assert reset_rows() == []


def test_reset_link_uses_app_base_url_not_host_header(outbox, monkeypatch):
    create_user()
    monkeypatch.setenv('APP_BASE_URL', 'https://motion.example.com/')
    spoofed_request_reset('http://evil.example', headers={'X-Forwarded-Host': 'evil.example'})
    link = LINK_RE.search(reset_emails(outbox)[-1]['text']).group(1)
    assert link.startswith('https://motion.example.com/reset-password/')
    assert 'evil' not in reset_emails(outbox)[-1]['text'] + reset_emails(outbox)[-1]['html']


def test_reset_link_defaults_to_local_base_url(outbox):
    create_user()
    spoofed_request_reset('http://evil.example')
    assert LINK_RE.search(reset_emails(outbox)[-1]['text']).group(1).startswith(
        'http://127.0.0.1:5001/reset-password/')


def test_reset_email_has_text_and_html_with_link(outbox):
    create_user()
    token = get_token(outbox)
    mail = reset_emails(outbox)[-1]
    assert token in mail['html']
    assert "didn't ask" in mail['text'] and "didn't ask" in mail['html']


# The reset page --------------------------------------------------------

def test_valid_token_shows_form_with_checklist_and_safe_headers(outbox):
    create_user()
    token = get_token(outbox)
    resp = new_client().get(f'/reset-password/{token}')
    html = resp.get_data(as_text=True)
    assert resp.status_code == 200
    assert 'id="resetForm"' in html and 'id="passwordRequirements"' in html
    assert resp.headers['Cache-Control'] == 'no-store'
    assert resp.headers['Referrer-Policy'] == 'no-referrer'
    # No third-party resources on a page whose URL holds the token
    assert not re.search(r'(src|href)="(https?:)?//', html)


def test_random_token_is_rejected():
    create_user()
    token = secrets.token_urlsafe(32)
    resp = new_client().get(f'/reset-password/{token}')
    assert is_invalid_page(resp)
    assert 'href="/forgot-password"' in resp.get_data(as_text=True)
    assert resp.headers['Cache-Control'] == 'no-store'
    assert submit_reset(token).status_code == 400
    assert submit_reset('x' * 500).status_code == 400


def test_expired_token_is_rejected(outbox):
    create_user()
    token = get_token(outbox)
    conn = sqlite3.connect(motion.db.db_name)
    conn.execute('UPDATE password_resets SET expires_at = ?', (time.time() - 1,))
    conn.commit()
    conn.close()
    assert is_invalid_page(new_client().get(f'/reset-password/{token}'))
    assert submit_reset(token).status_code == 400
    assert login(new_client()).status_code == 200  # password unchanged


def test_used_token_is_rejected(outbox):
    create_user()
    token = get_token(outbox)
    assert submit_reset(token).status_code == 200
    assert is_invalid_page(new_client().get(f'/reset-password/{token}'))
    assert submit_reset(token, 'An0ther!Pass').status_code == 400
    assert login(new_client(), password=NEW_PASSWORD).status_code == 200


def test_weak_password_is_rejected(outbox):
    create_user()
    token = get_token(outbox)
    for weak in ('short1!', 'alllowercase1!', 'NoNumbers!!', 'NoSpecial123', 'x' * 129):
        resp = submit_reset(token, weak)
        assert resp.status_code == 400, weak
        assert resp.get_json().get('success') is not True
    # The token is still usable after a rejected attempt
    assert submit_reset(token).status_code == 200


# After a reset ---------------------------------------------------------

def test_after_reset_old_password_fails_and_new_works(outbox):
    create_user()
    token = get_token(outbox)
    resp = submit_reset(token)
    assert resp.status_code == 200
    assert resp.get_json() == {'success': True, 'redirect': '/login'}
    assert login(new_client(), password=PASSWORD).status_code == 401
    assert login(new_client(), password=NEW_PASSWORD).status_code == 200


def test_new_password_is_hashed_like_register(outbox):
    user_id = create_user()
    submit_reset(get_token(outbox))
    stored = motion.db.get_user_by_id(user_id)['password']
    assert isinstance(stored, str) and stored.startswith('scrypt:')


def test_reset_logs_out_existing_sessions(outbox):
    logged_in = new_client()
    register(logged_in)
    assert logged_in.get('/dashboard').status_code == 200
    submit_reset(get_token(outbox))
    resp = logged_in.get('/dashboard')
    assert resp.status_code == 302 and resp.headers['Location'].endswith('/')


def test_reset_does_not_log_in_and_shows_message_on_login(outbox):
    create_user()
    client = new_client()
    submit_reset(get_token(outbox), client=client)
    with client.session_transaction() as s:
        assert 'user_id' not in s
    assert client.get('/dashboard').status_code == 302
    assert 'Password changed. Please log in.' in client.get('/login').get_data(as_text=True)


def test_reset_sends_password_changed_email(outbox):
    create_user()
    submit_reset(get_token(outbox))
    changed = [m for m in outbox if m['subject'] == 'Your Motion password was changed']
    assert [m['to'] for m in changed] == [EMAIL]


def test_reset_deletes_other_tokens_for_user(outbox):
    user_id = create_user()
    token = get_token(outbox)
    conn = sqlite3.connect(motion.db.db_name)
    conn.execute('INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)',
                 (user_id, 'c' * 64, time.time(), time.time() + 1800))
    conn.commit()
    conn.close()
    submit_reset(token)
    rows = reset_rows()
    assert len(rows) == 1 and rows[0]['used_at'] is not None


def test_raw_token_is_not_logged(outbox, caplog):
    create_user()
    with caplog.at_level(logging.DEBUG):
        token = get_token(outbox)
        new_client().get(f'/reset-password/{token}')
        # The request log line werkzeug would write
        logging.getLogger('werkzeug').info('127.0.0.1 - - "%s" 200 -', f'GET /reset-password/{token} HTTP/1.1')
    assert token not in caplog.text
    assert '/reset-password/[redacted]' in caplog.text


# Rate limits -----------------------------------------------------------

def test_forgot_password_rate_limit_per_email():
    for _ in range(3):
        assert request_reset().status_code == 200
    resp = request_reset(email=' Reset@Example.com')
    assert resp.status_code == 429
    assert 'this email' in resp.get_json()['error']
    assert request_reset(email='someone-else@example.com').status_code == 200


def test_forgot_password_rate_limit_per_ip():
    for i in range(10):
        assert request_reset(email=f'user{i}@example.com').status_code == 200
    resp = request_reset(email='user10@example.com')
    assert resp.status_code == 429
    assert 'network' in resp.get_json()['error']


def test_reset_password_rate_limit_per_ip():
    token = secrets.token_urlsafe(32)
    for _ in range(10):
        assert submit_reset(token).status_code == 400
    resp = submit_reset(token)
    assert resp.status_code == 429
    assert 'Too many' in resp.get_json()['error']


def test_forms_require_csrf_token():
    client = new_client()
    assert client.post('/forgot-password', json={'email': EMAIL}).status_code == 403
    assert client.post(f'/reset-password/{secrets.token_urlsafe(32)}',
                       json={'password': NEW_PASSWORD}).status_code == 403


# Mailer ----------------------------------------------------------------

def test_mailer_without_smtp_does_not_crash(monkeypatch, capsys, caplog):
    for var in ('SMTP_HOST', 'MAIL_FROM', 'DEV_MAIL_TO_CONSOLE'):
        monkeypatch.delenv(var, raising=False)
    with caplog.at_level(logging.WARNING):
        assert REAL_SEND_MAIL('a@example.com', 'S', 'link http://x/reset-password/T') is False
    assert 'not configured' in caplog.text
    assert 'reset-password' not in capsys.readouterr().out + caplog.text

    monkeypatch.setenv('DEV_MAIL_TO_CONSOLE', '1')
    assert REAL_SEND_MAIL('a@example.com', 'S', 'link http://x/reset-password/T') is False
    assert 'http://x/reset-password/T' in capsys.readouterr().out


def test_mailer_uses_starttls_and_login(monkeypatch):
    calls = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            calls.append(('connect', host, port))

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self, context):
            calls.append(('starttls',))

        def login(self, user, password):
            calls.append(('login', user, password))

        def send_message(self, msg):
            calls.append(('send', msg['To'], msg['From'], msg.is_multipart()))

    monkeypatch.setattr(mailer.smtplib, 'SMTP', FakeSMTP)
    monkeypatch.setenv('SMTP_HOST', 'smtp.example.com')
    monkeypatch.setenv('SMTP_PORT', '2525')
    monkeypatch.setenv('SMTP_USER', 'u')
    monkeypatch.setenv('SMTP_PASSWORD', 'p')
    monkeypatch.setenv('MAIL_FROM', 'Motion <noreply@example.com>')
    assert REAL_SEND_MAIL('a@example.com', 'S', 'text', '<p>html</p>') is True
    assert calls == [('connect', 'smtp.example.com', 2525), ('starttls',), ('login', 'u', 'p'),
                     ('send', 'a@example.com', 'Motion <noreply@example.com>', True)]


# Change password (logged in) -------------------------------------------

def test_change_password_requires_login():
    resp = call(new_client(), 'POST', '/account/password',
                json={'current_password': PASSWORD, 'new_password': NEW_PASSWORD})
    assert resp.status_code == 302


def test_change_password_keeps_current_session_and_logs_out_others(outbox):
    current = new_client()
    register(current)
    other = new_client()
    assert login(other).status_code == 200

    resp = call(current, 'POST', '/account/password',
                json={'current_password': PASSWORD, 'new_password': NEW_PASSWORD})
    assert resp.status_code == 200 and resp.get_json()['success'] is True

    assert current.get('/dashboard').status_code == 200
    assert other.get('/dashboard').status_code == 302
    assert login(new_client(), password=PASSWORD).status_code == 401
    assert login(new_client(), password=NEW_PASSWORD).status_code == 200
    assert any(m['subject'] == 'Your Motion password was changed' for m in outbox)


def test_change_password_rejects_wrong_current_and_weak_new():
    client = new_client()
    register(client)
    wrong = call(client, 'POST', '/account/password',
                 json={'current_password': 'Wr0ng!Pass', 'new_password': NEW_PASSWORD})
    assert wrong.status_code == 400
    weak = call(client, 'POST', '/account/password',
                json={'current_password': PASSWORD, 'new_password': 'weak'})
    assert weak.status_code == 400
    assert login(new_client(), password=PASSWORD).status_code == 200


def test_change_password_invalidates_reset_tokens(outbox):
    client = new_client()
    register(client)
    token = get_token(outbox)
    call(client, 'POST', '/account/password', json={'current_password': PASSWORD, 'new_password': NEW_PASSWORD})
    assert submit_reset(token, 'An0ther!Pass').status_code == 400


def test_login_page_links_to_forgot_password():
    html = new_client().get('/login').get_data(as_text=True)
    assert 'href="/forgot-password"' in html
    assert new_client().get('/forgot-password').status_code == 200

