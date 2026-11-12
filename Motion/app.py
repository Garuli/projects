from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from database import Database
import mailer
import os
from functools import wraps
import re
import json
import hashlib
import hmac
import logging
import secrets
import threading
import time
from datetime import timedelta
import urllib.request as urlrequest
import urllib.error as urlerror
from werkzeug.exceptions import BadRequest
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_KEY_FILE = os.path.join(BASE_DIR, '.secret_key')


def load_secret_key():
    """SECRET_KEY env var, else a random key persisted to .secret_key (mode 600)."""
    key = os.environ.get('SECRET_KEY')
    if key:
        return key
    try:
        with open(SECRET_KEY_FILE) as f:
            key = f.read().strip()
        if key:
            return key
    except FileNotFoundError:
        pass
    key = secrets.token_hex(32)
    fd = os.open(SECRET_KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(key)
    os.chmod(SECRET_KEY_FILE, 0o600)
    return key


SESSION_LIFETIME = timedelta(hours=8)

app = Flask(__name__)
app.config.update(
    SECRET_KEY=load_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get('SESSION_COOKIE_SECURE') == '1',
    PERMANENT_SESSION_LIFETIME=SESSION_LIFETIME,
    MAX_CONTENT_LENGTH=1024 * 1024,  # 1 MB
)

# Rate limiting (in-memory, per IP). Behind a reverse proxy, configure
# werkzeug's ProxyFix or every client will share the proxy's IP.
limiter = Limiter(get_remote_address, app=app, storage_uri='memory://')


class RedactResetTokenFilter(logging.Filter):
    """Keep raw reset tokens out of the request log (werkzeug logs every URL)."""
    _token_in_url = re.compile(r'(/reset-password/)[^\s?"]+')

    def filter(self, record):
        message = record.getMessage()
        if '/reset-password/' in message:
            record.msg = self._token_in_url.sub(r'\1[redacted]', message)
            record.args = ()
        return True


logging.getLogger('werkzeug').addFilter(RedactResetTokenFilter())

# Initialize database (path from MOTION_DB, default motion.db)
db = Database()

# Input limits
MAX_EMAIL_LENGTH = 254
MAX_NAME_LENGTH = 100
MAX_PASSWORD_LENGTH = 128
MAX_TITLE_LENGTH = 200
MAX_TAG_LENGTH = 50
MAX_TAGS = 20
MAX_CONTENT_CHARS = 500_000
MAX_CHAT_MESSAGE_LENGTH = 4000
MAX_AI_INPUT_LENGTH = 20_000
MAX_PROPERTY_OPTIONS = 50
MAX_ITEM_VALUE_LENGTH = 10_000
PROPERTY_TYPES = {'title', 'text', 'number', 'select', 'multi_select', 'date',
                  'checkbox', 'url', 'email', 'phone', 'rating'}
VIEW_TYPES = {'table', 'board', 'calendar', 'list'}
EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

LOGIN_ERROR = 'Invalid credentials'


def json_body():
    """The request's JSON object, or a 400 if the body isn't a JSON object."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise BadRequest('Request body must be a JSON object')
    return data


def get_str(data, key, default='', max_len=None, field=None):
    """A string field from a JSON body, or a 400 if it has the wrong type or is too long."""
    value = data.get(key, default)
    if value is None:
        return None
    if not isinstance(value, str):
        raise BadRequest(f'{field or key} must be a string')
    if max_len is not None and len(value) > max_len:
        raise BadRequest(f'{field or key} must be at most {max_len} characters')
    return value


def validate_item_properties(props):
    if not isinstance(props, dict):
        raise BadRequest('properties must be an object')
    for key, value in props.items():
        if len(key) > MAX_TITLE_LENGTH:
            raise BadRequest('Property name too long')
        if isinstance(value, str):
            if len(value) > MAX_ITEM_VALUE_LENGTH:
                raise BadRequest('Property value too long')
        elif isinstance(value, list):
            if not all(isinstance(v, str) and len(v) <= MAX_TITLE_LENGTH for v in value):
                raise BadRequest('Invalid property value')
        elif value is not None and not isinstance(value, (int, float, bool)):
            raise BadRequest('Invalid property value')
    return props


# Session handling
def start_session(user):
    """Start a fresh session for user (clears any pre-login session data)."""
    session.clear()
    session.permanent = True
    session['user_id'] = user['id']
    session['user_email'] = user['email']
    session['user_name'] = user['name']
    session['session_version'] = user.get('session_version', 0)
    session['login_at'] = int(time.time())
    session['csrf_token'] = secrets.token_hex(32)


def current_user_id():
    """The logged-in user's id, or None. Clears sessions that are stale or revoked."""
    user_id = session.get('user_id')
    if user_id is None:
        return None
    version = db.get_session_version(user_id)
    expired = time.time() - session.get('login_at', 0) > SESSION_LIFETIME.total_seconds()
    if version is None or session.get('session_version') != version or expired:
        session.clear()
        return None
    return user_id


# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user_id() is None:
            return redirect(url_for('landing'))
        return f(*args, **kwargs)
    return decorated_function


# CSRF protection
def get_csrf_token():
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


@app.context_processor
def inject_csrf_token():
    return {'csrf_token': get_csrf_token}


@app.before_request
def csrf_protect():
    if request.method in ('GET', 'HEAD', 'OPTIONS'):
        return None
    expected = session.get('csrf_token', '')
    # Header for fetch() calls; form field for the plain logout form
    sent = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token', '')
    if not expected or not hmac.compare_digest(expected, sent):
        return jsonify({'error': 'Invalid or missing CSRF token'}), 403
    return None


# Security headers
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self'; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "form-action 'self'; "
    "frame-ancestors 'none'"
)


@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Content-Security-Policy'] = CONTENT_SECURITY_POLICY
    if 'user_id' in session:
        response.headers['Cache-Control'] = 'no-store'
    return response


# JSON error responses
@app.errorhandler(400)
def bad_request(e):
    return jsonify({'error': getattr(e, 'description', None) or 'Bad request'}), 400


@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'Request body too large (max 1 MB)'}), 413


@app.errorhandler(429)
def rate_limited(e):
    # Limits declared with error_message= show that message; the rest a generic one
    limit = getattr(e, 'limit', None)
    if limit is not None and limit.error_message:
        return jsonify({'error': e.description}), 429
    return jsonify({'error': 'Too many requests. Please wait a minute and try again.'}), 429


# Password validation
def validate_password(password):
    if len(password) > MAX_PASSWORD_LENGTH:
        return False, f"Password must be at most {MAX_PASSWORD_LENGTH} characters"
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Need uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Need lowercase letter"
    if not re.search(r'\d', password):
        return False, "Need number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Need special character"
    return True, "Strong password"

@app.route('/')
def landing():
    if current_user_id() is not None:
        return redirect(url_for('dashboard'))
    return render_template('landing.html')

@app.route('/register', methods=['GET', 'POST'])
@limiter.limit('10/hour', methods=['POST'])
def register():
    if current_user_id() is not None:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        data = json_body()
        email = (get_str(data, 'email', max_len=MAX_EMAIL_LENGTH) or '').strip().lower()
        password = get_str(data, 'password', max_len=MAX_PASSWORD_LENGTH) or ''
        name = (get_str(data, 'name', max_len=MAX_NAME_LENGTH) or '').strip()

        if not email or not password or not name:
            return jsonify({'success': False, 'message': 'All fields required'}), 400

        if not EMAIL_RE.match(email):
            return jsonify({'success': False, 'message': 'Invalid email'}), 400
        
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400
        
        if db.get_user_by_email(email):
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        user_id = db.create_user(email, password, name)
        
        if user_id:
            start_session({'id': user_id, 'email': email, 'name': name, 'session_version': 0})
            return jsonify({'success': True})

        return jsonify({'success': False, 'message': 'Registration failed'}), 500

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit('5/minute;20/hour', methods=['POST'])
def login():
    if current_user_id() is not None:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        data = json_body()
        email = (get_str(data, 'email', max_len=MAX_EMAIL_LENGTH) or '').strip().lower()
        password = data.get('password', '')

        if not email or not password or not isinstance(password, str):
            return jsonify({'success': False, 'message': 'Email and password required'}), 400

        if db.is_login_locked(email):
            return jsonify({'success': False, 'error': 'Too many failed attempts for this account. '
                            'Try again in 15 minutes.'}), 429

        # Over-long passwords get the same generic error (and skip hashing)
        user = db.verify_user(email, password) if len(password) <= 1024 else None

        if user:
            db.clear_failed_logins(email)
            start_session(user)
            return jsonify({'success': True})

        db.record_failed_login(email)
        return jsonify({'success': False, 'message': LOGIN_ERROR}), 401

    return render_template('login.html')

# Password reset ----------------------------------------------------------
RESET_TOKEN_TTL_SECONDS = 30 * 60
MAX_RESET_TOKEN_LENGTH = 100  # token_urlsafe(32) is 43 characters
RESET_REQUESTED_MESSAGE = "If an account exists for that email, we've sent a reset link."
RESET_INVALID_MESSAGE = 'This password reset link is invalid or has expired.'


def app_base_url():
    """Base URL for links in emails. Never derived from the request's Host header."""
    return os.environ.get('APP_BASE_URL', 'http://127.0.0.1:5001').rstrip('/')


def hash_reset_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def run_in_background(func, *args):
    """Run func in a daemon thread so the response doesn't wait (or leak timing)."""
    def runner():
        try:
            func(*args)
        except Exception:
            app.logger.exception('Background task failed')
    threading.Thread(target=runner, daemon=True).start()


def forgot_password_email_key():
    """Rate-limit key: the normalized email in the body (falls back to the IP)."""
    data = request.get_json(silent=True)
    email = data.get('email') if isinstance(data, dict) else None
    if isinstance(email, str) and email.strip():
        return 'forgot-password-email:' + email.strip().lower()[:MAX_EMAIL_LENGTH]
    return 'forgot-password-ip:' + get_remote_address()


def process_reset_request(email):
    """Runs in the background: create a token and email it if the account exists."""
    db.delete_stale_password_resets()
    user = db.get_user_by_email(email)
    if not user:
        return
    token = secrets.token_urlsafe(32)
    db.create_password_reset(user['id'], hash_reset_token(token), RESET_TOKEN_TTL_SECONDS)
    link = f'{app_base_url()}/reset-password/{token}'
    minutes = RESET_TOKEN_TTL_SECONDS // 60
    text = (
        f"Hi {user['name']},\n\n"
        f"Someone asked to reset the password for your Motion account.\n"
        f"Open this link to choose a new password (valid for {minutes} minutes, one use only):\n\n"
        f"{link}\n\n"
        f"If you didn't ask for this, you can ignore this email. Your password won't change.\n"
    )
    html = render_reset_email_html(user['name'], link, minutes)
    mailer.send_mail(user['email'], 'Reset your Motion password', text, html)


def render_reset_email_html(name, link, minutes):
    with app.app_context():
        return render_template('email/reset_password.html', name=name, link=link, minutes=minutes)


def send_password_changed_email(user):
    text = (
        f"Hi {user['name']},\n\n"
        f"The password for your Motion account was just changed, and every other device was signed out.\n\n"
        f"If this wasn't you, reset your password right away: {app_base_url()}/forgot-password\n"
    )
    with app.app_context():
        html = render_template('email/password_changed.html', name=user['name'],
                               link=f'{app_base_url()}/forgot-password')
    run_in_background(mailer.send_mail, user['email'], 'Your Motion password was changed', text, html)


def find_valid_reset(token):
    """The valid reset row for a raw token from the URL, or None."""
    if not token or len(token) > MAX_RESET_TOKEN_LENGTH:
        return None
    token_hash = hash_reset_token(token)
    reset = db.get_valid_password_reset(token_hash)
    if not reset or not hmac.compare_digest(reset['token_hash'], token_hash):
        return None
    return reset


@app.route('/forgot-password', methods=['GET', 'POST'])
@limiter.limit('10/hour', methods=['POST'],
               error_message='Too many reset requests from your network. Please try again in an hour.')
@limiter.limit('3/hour', methods=['POST'], key_func=forgot_password_email_key,
               error_message='Too many reset requests for this email. Please try again in an hour.')
def forgot_password():
    if request.method == 'POST':
        data = json_body()
        email = (get_str(data, 'email', max_len=MAX_EMAIL_LENGTH) or '').strip().lower()
        if not email or not EMAIL_RE.match(email):
            return jsonify({'success': False, 'message': 'Enter a valid email address'}), 400
        # All lookups and the email happen off the request thread, so the
        # response is identical (content and timing) whether or not the account exists.
        run_in_background(process_reset_request, email)
        return jsonify({'success': True, 'message': RESET_REQUESTED_MESSAGE})

    return render_template('forgot_password.html')


@app.route('/reset-password/<token>', methods=['GET', 'POST'])
@limiter.limit('10/hour', methods=['POST'],
               error_message='Too many password reset attempts. Please try again in an hour.')
def reset_password(token):
    reset = find_valid_reset(token)

    if request.method == 'POST':
        if not reset:
            return jsonify({'success': False, 'message': RESET_INVALID_MESSAGE}), 400
        data = json_body()
        password = get_str(data, 'password', max_len=MAX_PASSWORD_LENGTH) or ''
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400
        if not db.use_password_reset(reset['id'], reset['user_id'], db.hash_password(password)):
            return jsonify({'success': False, 'message': RESET_INVALID_MESSAGE}), 400
        user = db.get_user_by_id(reset['user_id'])
        if user:
            send_password_changed_email(user)
        session.clear()  # no auto-login; the user signs in with the new password
        flash('Password changed. Please log in.')
        return jsonify({'success': True, 'redirect': url_for('login')})

    if reset:
        response = app.make_response(render_template('reset_password.html', valid=True))
    else:
        response = app.make_response((render_template('reset_password.html', valid=False), 400))
    # The token is in the URL: don't cache the page or leak it via Referer
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


@app.route('/account/password', methods=['GET', 'POST'])
@login_required
@limiter.limit('5/minute;20/hour', methods=['POST'],
               error_message='Too many attempts. Please try again later.')
def change_password():
    if request.method == 'POST':
        data = json_body()
        current = get_str(data, 'current_password', max_len=MAX_PASSWORD_LENGTH) or ''
        new = get_str(data, 'new_password', max_len=MAX_PASSWORD_LENGTH) or ''
        if not current or not new:
            return jsonify({'success': False, 'message': 'Both passwords are required'}), 400

        user = db.get_user_by_id(session['user_id'])
        if not user or not db.verify_password(user['password'], current):
            return jsonify({'success': False, 'message': 'Current password is incorrect'}), 400

        is_valid, message = validate_password(new)
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400

        # Revokes every other session; keep this one by adopting the new version
        session['session_version'] = db.change_password(user['id'], db.hash_password(new))
        send_password_changed_email(user)
        return jsonify({'success': True, 'message': 'Password changed. Other devices were signed out.'})

    return render_template('change_password.html')


@app.route('/logout', methods=['POST'])
def logout():
    user_id = current_user_id()
    if user_id is not None:
        # Revoke this cookie (and any copies of it) server-side
        db.bump_session_version(user_id)
    session.clear()
    return redirect(url_for('landing'))

@app.route('/dashboard')
@login_required
def dashboard():
    pages = db.get_user_pages(session['user_id'])
    databases = db.get_user_databases(session['user_id'])
    chats = db.get_user_chats(session['user_id'])
    return render_template('dashboard.html', 
                         pages=pages, 
                         databases=databases, 
                         chats=chats,
                         user_name=session.get('user_name'))

@app.route('/page/<int:page_id>')
@login_required
def view_page(page_id):
    page = db.get_page(page_id)
    
    if not page or page['user_id'] != session['user_id']:
        return redirect(url_for('dashboard'))
    
    pages = db.get_user_pages(session['user_id'])
    databases = db.get_user_databases(session['user_id'])
    chats = db.get_user_chats(session['user_id'])
    tags = db.get_page_tags(page_id)
    
    return render_template('page.html', 
                         page=page, 
                         pages=pages, 
                         databases=databases, 
                         chats=chats,
                         tags=tags, 
                         user_name=session.get('user_name'),
                         current_page_id=page_id)

@app.route('/database/<int:database_id>')
@login_required
def view_database(database_id):
    database = db.get_database(database_id)
    
    if not database or database['user_id'] != session['user_id']:
        return redirect(url_for('dashboard'))
    
    pages = db.get_user_pages(session['user_id'])
    databases = db.get_user_databases(session['user_id'])
    chats = db.get_user_chats(session['user_id'])
    properties = db.get_database_properties(database_id)
    items = db.get_database_items(database_id)
    
    return render_template('database.html', 
                         database=database, 
                         pages=pages,
                         databases=databases,
                         chats=chats,
                         properties=properties,
                         items=items,
                         user_name=session.get('user_name'),
                         current_database_id=database_id)

def chat_with_ollama(messages):
    model = os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.3}
    }).encode('utf-8')
    req = urlrequest.Request(
        "http://localhost:11434/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urlrequest.urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode('utf-8'))
    except urlerror.URLError as e:
        raise RuntimeError(
            "Ollama server not running. Start it with `ollama serve`."
        ) from e

    message = data.get('message', {})
    content = message.get('content', '').strip()
    if not content:
        raise RuntimeError("No response from the local model.")
    return content

@app.route('/chat')
@login_required
def chat_home():
    chats = db.get_user_chats(session['user_id'])
    if chats:
        return redirect(url_for('view_chat', chat_id=chats[0]['id']))
    chat_id = db.create_chat(session['user_id'])
    return redirect(url_for('view_chat', chat_id=chat_id))

@app.route('/chat/<int:chat_id>')
@login_required
def view_chat(chat_id):
    chat = db.get_chat(chat_id)
    if not chat or chat['user_id'] != session['user_id']:
        return redirect(url_for('chat_home'))

    pages = db.get_user_pages(session['user_id'])
    databases = db.get_user_databases(session['user_id'])
    chats = db.get_user_chats(session['user_id'])
    messages = db.get_chat_messages(chat_id)

    return render_template(
        'chat.html',
        chat=chat,
        messages=messages,
        pages=pages,
        databases=databases,
        chats=chats,
        user_name=session.get('user_name'),
        current_chat_id=chat_id
    )

@app.route('/api/chats', methods=['GET', 'POST'])
@login_required
def api_chats():
    if request.method == 'POST':
        data = json_body()
        title = (get_str(data, 'title', 'New Chat', MAX_TITLE_LENGTH) or '').strip() or 'New Chat'
        chat_id = db.create_chat(session['user_id'], title)
        return jsonify({'id': chat_id, 'success': True})

    chats = db.get_user_chats(session['user_id'])
    return jsonify(chats)

@app.route('/api/chats/<int:chat_id>/messages', methods=['GET', 'POST'])
@login_required
def api_chat_messages(chat_id):
    chat = db.get_chat(chat_id)
    if not chat or chat['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404

    if request.method == 'GET':
        messages = db.get_chat_messages(chat_id)
        return jsonify(messages)

    data = json_body()
    content = (get_str(data, 'message', max_len=MAX_CHAT_MESSAGE_LENGTH) or '').strip()
    if not content:
        return jsonify({'error': 'Message required'}), 400

    db.add_chat_message(chat_id, 'user', content)

    if chat['title'] == 'New Chat':
        title = content[:40].strip()
        db.update_chat_title(chat_id, title or 'New Chat')

    history = db.get_chat_messages(chat_id)[-12:]
    system_prompt = (
        "You are Motion Chat, a helpful assistant for writing, phrasing, "
        "planning, and general questions. Be concise and accurate."
    )
    messages = [{'role': 'system', 'content': system_prompt}]
    messages.extend({'role': m['role'], 'content': m['content']} for m in history)

    try:
        reply = chat_with_ollama(messages)
        db.add_chat_message(chat_id, 'assistant', reply)
        return jsonify({'success': True, 'reply': reply})
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 503
    except Exception:
        app.logger.exception('Unexpected error talking to Ollama')
        return jsonify({'error': 'Unexpected server error'}), 500

# API - Pages
@app.route('/api/pages', methods=['GET', 'POST'])
@login_required
def api_pages():
    if request.method == 'POST':
        data = json_body()
        title = get_str(data, 'title', 'Untitled', MAX_TITLE_LENGTH) or 'Untitled'
        content = get_str(data, 'content', '', MAX_CONTENT_CHARS) or ''
        
        page_id = db.create_page(title, content, session['user_id'])
        return jsonify({'id': page_id, 'success': True})
    
    pages = db.get_user_pages(session['user_id'])
    return jsonify(pages)

@app.route('/api/pages/<int:page_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_page(page_id):
    page = db.get_page(page_id)
    if not page or page['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    if request.method == 'GET':
        return jsonify(page)
    
    elif request.method == 'PUT':
        data = json_body()
        db.update_page(page_id,
                       get_str(data, 'title', None, MAX_TITLE_LENGTH),
                       get_str(data, 'content', None, MAX_CONTENT_CHARS))
        return jsonify({'success': True})
    
    elif request.method == 'DELETE':
        db.delete_page(page_id)
        return jsonify({'success': True})

@app.route('/api/pages/<int:page_id>/tags', methods=['POST'])
@login_required
def api_page_tags(page_id):
    page = db.get_page(page_id)
    if not page or page['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    data = json_body()
    tags = data.get('tags', [])
    if not isinstance(tags, list) or len(tags) > MAX_TAGS:
        return jsonify({'error': f'tags must be a list of at most {MAX_TAGS} strings'}), 400
    if not all(isinstance(t, str) and len(t.strip()) <= MAX_TAG_LENGTH for t in tags):
        return jsonify({'error': f'Each tag must be a string of at most {MAX_TAG_LENGTH} characters'}), 400
    
    db.clear_page_tags(page_id)
    for tag in tags:
        if tag.strip():
            db.add_tag_to_page(page_id, tag.strip())
    
    return jsonify({'success': True})

# API - Databases
@app.route('/api/databases', methods=['GET', 'POST'])
@login_required
def api_databases():
    if request.method == 'POST':
        data = json_body()
        title = get_str(data, 'title', 'Untitled Database', MAX_TITLE_LENGTH) or 'Untitled Database'
        
        database_id = db.create_database(title, session['user_id'])
        
        # Create default properties
        db.create_property(database_id, 'Name', 'title', 0)
        db.create_property(database_id, 'Status', 'select', 1, '["To Do", "In Progress", "Done"]')
        db.create_property(database_id, 'Priority', 'select', 2, '["High", "Medium", "Low"]')
        db.create_property(database_id, 'Due Date', 'date', 3)
        
        return jsonify({'id': database_id, 'success': True})
    
    databases = db.get_user_databases(session['user_id'])
    return jsonify(databases)

@app.route('/api/databases/<int:database_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_database(database_id):
    database = db.get_database(database_id)
    if not database or database['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    if request.method == 'GET':
        properties = db.get_database_properties(database_id)
        items = db.get_database_items(database_id)
        return jsonify({'database': database, 'properties': properties, 'items': items})
    
    elif request.method == 'PUT':
        data = json_body()
        view_type = get_str(data, 'view_type', None)
        if view_type is not None and view_type not in VIEW_TYPES:
            return jsonify({'error': 'Invalid view_type'}), 400
        db.update_database(database_id, get_str(data, 'title', None, MAX_TITLE_LENGTH), view_type)
        return jsonify({'success': True})
    
    elif request.method == 'DELETE':
        db.delete_database(database_id)
        return jsonify({'success': True})

# API - Database Items
@app.route('/api/databases/<int:database_id>/items', methods=['POST'])
@login_required
def api_create_item(database_id):
    database = db.get_database(database_id)
    if not database or database['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    data = json_body()
    properties = validate_item_properties(data.get('properties') or {})
    
    item_id = db.create_database_item(database_id, properties)
    item = db.get_database_item(item_id)
    return jsonify({'id': item_id, 'item': item, 'success': True})

@app.route('/api/items/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_item(item_id):
    item = db.get_database_item(item_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404
    
    database = db.get_database(item['database_id'])
    if not database or database['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    if request.method == 'GET':
        return jsonify(item)
    
    elif request.method == 'PUT':
        data = json_body()
        properties = data.get('properties')
        if properties is not None:
            validate_item_properties(properties)
        order = data.get('order')
        if order is not None and (not isinstance(order, int) or isinstance(order, bool)):
            return jsonify({'error': 'order must be an integer'}), 400
        db.update_database_item(item_id, properties, order)
        updated_item = db.get_database_item(item_id)
        return jsonify({'success': True, 'item': updated_item})
    
    elif request.method == 'DELETE':
        db.delete_database_item(item_id)
        return jsonify({'success': True})

@app.route('/api/search')
@login_required
def api_search():
    query = request.args.get('q', '')[:MAX_TITLE_LENGTH]
    if not query:
        return jsonify([])
    
    results = db.search_user_pages(session['user_id'], query)
    return jsonify(results)

def improve_text_with_ollama(content):
    model = os.environ.get('OLLAMA_MODEL', 'llama3.1:8b')
    prompt = (
        "You are a helpful writing assistant. Improve clarity, grammar, and flow "
        "without changing the meaning or tone. Return only the improved text.\n\n"
        f"Text:\n{content}\n\nImproved text:"
    )
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3}
    }).encode('utf-8')
    req = urlrequest.Request(
        "http://localhost:11434/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urlrequest.urlopen(req, timeout=60) as response:
            data = json.loads(response.read().decode('utf-8'))
    except urlerror.URLError as e:
        raise RuntimeError(
            "Ollama server not running. Start it with `ollama serve` or run "
            "`ollama run llama3.1:8b` first."
        ) from e

    improved = data.get('response', '').strip()
    if not improved:
        raise RuntimeError("No response from the local model.")
    return improved

@app.route('/api/ai/improve', methods=['POST'])
@login_required
def ai_improve():
    data = json_body()
    content = (get_str(data, 'content', max_len=MAX_AI_INPUT_LENGTH) or '').strip()

    if not content:
        return jsonify({'error': 'No content provided'}), 400

    try:
        improved = improve_text_with_ollama(content)
        return jsonify({'success': True, 'improved': improved})
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 503
    except Exception:
        app.logger.exception('Unexpected error talking to Ollama')
        return jsonify({'error': 'Unexpected server error'}), 500

@app.route('/api/export/<int:page_id>')
@login_required
def api_export(page_id):
    page = db.get_page(page_id)
    
    if not page or page['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    markdown = f"# {page['title']}\n\n{page['content']}"
    # Keep the filename header-safe (no quotes, newlines or path characters)
    filename = re.sub(r'[^A-Za-z0-9 _.-]', '_', page['title']).strip()[:100] or 'page'
    
    from flask import Response
    return Response(
        markdown,
        mimetype='text/markdown',
        headers={'Content-Disposition': f'attachment; filename="{filename}.md"'}
    )

# Property Management Routes
@app.route('/api/databases/<int:database_id>/properties', methods=['POST'])
@login_required
def api_add_property(database_id):
    """Add new property to database"""
    database = db.get_database(database_id)
    if not database or database['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    data = json_body()
    name = (get_str(data, 'name', 'New Property', MAX_TITLE_LENGTH) or '').strip() or 'New Property'
    prop_type = get_str(data, 'type', 'text') or 'text'
    if prop_type not in PROPERTY_TYPES:
        return jsonify({'error': 'Invalid property type'}), 400
    options = data.get('options')
    if options is not None and (
            not isinstance(options, list) or len(options) > MAX_PROPERTY_OPTIONS or
            not all(isinstance(o, str) and len(o) <= MAX_TITLE_LENGTH for o in options)):
        return jsonify({'error': 'options must be a list of short strings'}), 400
    
    if options:
        options = json.dumps(options)
    
    prop_id = db.add_property_to_database(database_id, name, prop_type, options)
    return jsonify({'id': prop_id, 'success': True})

@app.route('/api/properties/<int:property_id>', methods=['DELETE'])
@login_required
def api_delete_property(property_id):
    """Delete a property (only in a database the user owns)"""
    if not db.delete_property(property_id, session['user_id']):
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'success': True})

# Filter & Sort Routes
@app.route('/api/databases/<int:database_id>/filter', methods=['POST'])
@login_required
def api_filter_items(database_id):
    """Filter database items"""
    database = db.get_database(database_id)
    if not database or database['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    data = json_body()
    filters = data.get('filters') or []
    sort_by = data.get('sort_by')
    sort_order = data.get('sort_order', 'asc')
    if not isinstance(filters, list) or not all(isinstance(f, dict) for f in filters):
        return jsonify({'error': 'filters must be a list of objects'}), 400
    
    items = db.get_database_items(database_id)
    
    # Apply filters
    filtered_items = items
    for filter_rule in filters:
        property_name = filter_rule.get('property')
        operator = filter_rule.get('operator')
        value = filter_rule.get('value')
        
        if operator == 'equals':
            filtered_items = [item for item in filtered_items 
                            if item['properties'].get(property_name) == value]
        elif operator == 'contains':
            filtered_items = [item for item in filtered_items 
                            if str(value or '').lower() in str(item['properties'].get(property_name, '')).lower()]
        elif operator == 'is_empty':
            filtered_items = [item for item in filtered_items 
                            if not item['properties'].get(property_name)]
        elif operator == 'is_not_empty':
            filtered_items = [item for item in filtered_items 
                            if item['properties'].get(property_name)]
    
    # Apply sorting
    if sort_by:
        reverse = (sort_order == 'desc')
        filtered_items.sort(
            key=lambda x: str(x['properties'].get(sort_by, '')),
            reverse=reverse
        )
    
    return jsonify({'items': filtered_items, 'count': len(filtered_items)})


if __name__ == '__main__':
    # 5000 is taken by macOS AirPlay Receiver, so default to 5001.
    # Local-only and no debugger by default; set HOST / FLASK_DEBUG=1 to change.
    app.run(debug=os.environ.get('FLASK_DEBUG') == '1',
            host=os.environ.get('HOST', '127.0.0.1'),
            port=int(os.environ.get('PORT', 5001)))
