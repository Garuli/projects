import sqlite3
from datetime import datetime
import hashlib
import hmac
import os
import json
import secrets
import time
from werkzeug.security import generate_password_hash, check_password_hash

# Checked when an email doesn't exist, so a failed login takes about the same
# time whether or not the account exists.
_DUMMY_PASSWORD_HASH = generate_password_hash(secrets.token_hex(16))

# Per-email lockout: this many failed logins inside the window locks the email.
LOGIN_LOCK_MAX_FAILURES = 5
LOGIN_LOCK_WINDOW_SECONDS = 15 * 60

class Database:
    def __init__(self, db_name=None):
        # MOTION_DB lets tests (or deployments) point at a different SQLite file
        db_name = db_name or os.environ.get('MOTION_DB', 'motion.db')
        self.db_name = db_name
        self.init_db()
    
    def get_connection(self):
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        # SQLite ignores FOREIGN KEY / ON DELETE CASCADE unless this is set per connection
        conn.execute('PRAGMA foreign_keys = ON')
        return conn
    
    def hash_password(self, password):
        # Werkzeug format string, e.g. "scrypt:32768:8:1$salt$hash"
        return generate_password_hash(password)
    
    def is_legacy_hash(self, stored_password):
        # Old format: raw bytes = 32-byte salt + PBKDF2-SHA256 (100k iterations)
        return isinstance(stored_password, (bytes, bytearray, memoryview))
    
    def verify_password(self, stored_password, provided_password):
        if self.is_legacy_hash(stored_password):
            stored_password = bytes(stored_password)
            salt = stored_password[:32]
            stored_hash = stored_password[32:]
            pwdhash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
            return hmac.compare_digest(pwdhash, stored_hash)
        # check_password_hash compares with hmac.compare_digest internally
        return check_password_hash(stored_password, provided_password)
    
    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password BLOB NOT NULL,
                name TEXT NOT NULL,
                session_version INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Migrate databases created before session_version existed
        cursor.execute('PRAGMA table_info(users)')
        user_columns = [row[1] for row in cursor.fetchall()]
        if 'session_version' not in user_columns:
            cursor.execute('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0')
        
        # Failed login attempts (per-email lockout)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                attempted_at REAL NOT NULL
            )
        ''')
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts (email, attempted_at)'
        )
        
        # Password reset tokens: only the SHA-256 of each token is stored.
        # Times are Unix timestamps (like login_attempts).
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS password_resets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT UNIQUE NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL,
                used_at REAL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets (user_id)'
        )
        
        # Pages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT DEFAULT '',
                user_id INTEGER NOT NULL,
                parent_id INTEGER,
                icon TEXT DEFAULT '📄',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
            )
        ''')
        
        # Databases table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS databases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                view_type TEXT DEFAULT 'table',
                icon TEXT DEFAULT '📊',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')
        
        # Database properties (columns)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS database_properties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                database_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                order_index INTEGER DEFAULT 0,
                options TEXT,
                FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
            )
        ''')
        
        # Database items (rows/tasks)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS database_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                database_id INTEGER NOT NULL,
                properties TEXT DEFAULT '{}',
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
            )
        ''')
        
        # Tags table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        ''')
        
        # Page-Tags junction
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS page_tags (
                page_id INTEGER,
                tag_id INTEGER,
                PRIMARY KEY (page_id, tag_id),
                FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        ''')

        # Chat threads
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_threads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ''')

        # Chat messages
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chat_threads(id) ON DELETE CASCADE
            )
        ''')
        
        conn.commit()
        conn.close()
    
    # User methods
    def create_user(self, email, password, name):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            hashed_password = self.hash_password(password)
            cursor.execute(
                'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
                (email, hashed_password, name)
            )
            user_id = cursor.lastrowid
            conn.commit()
            return user_id
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()
    
    def get_user_by_email(self, email):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def verify_user(self, email, password):
        user = self.get_user_by_email(email)
        if not user:
            # Same work as a real check so timing doesn't reveal which emails exist
            check_password_hash(_DUMMY_PASSWORD_HASH, password)
            return None
        if not self.verify_password(user['password'], password):
            return None
        if self.is_legacy_hash(user['password']):
            # Silently upgrade old-format hashes on successful login
            self.update_password_hash(user['id'], self.hash_password(password))
        return user
    
    def update_password_hash(self, user_id, password_hash):
        conn = self.get_connection()
        conn.execute('UPDATE users SET password = ? WHERE id = ?', (password_hash, user_id))
        conn.commit()
        conn.close()
    
    def get_session_version(self, user_id):
        """Current session_version for a user, or None if the user no longer exists"""
        conn = self.get_connection()
        row = conn.execute('SELECT session_version FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        return row[0] if row else None
    
    def bump_session_version(self, user_id):
        """Invalidate every existing session cookie for this user"""
        conn = self.get_connection()
        conn.execute(
            'UPDATE users SET session_version = session_version + 1 WHERE id = ?', (user_id,)
        )
        conn.commit()
        conn.close()
    
    def get_user_by_id(self, user_id):
        conn = self.get_connection()
        row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        return dict(row) if row else None
    
    def change_password(self, user_id, password_hash):
        """Set a new password, revoke all sessions and reset tokens. Returns the new session_version."""
        conn = self.get_connection()
        try:
            conn.execute(
                'UPDATE users SET password = ?, session_version = session_version + 1 WHERE id = ?',
                (password_hash, user_id)
            )
            conn.execute('DELETE FROM password_resets WHERE user_id = ?', (user_id,))
            row = conn.execute('SELECT session_version FROM users WHERE id = ?', (user_id,)).fetchone()
            conn.commit()
            return row[0] if row else None
        finally:
            conn.close()
    
    # Password reset methods
    def delete_stale_password_resets(self):
        """Remove expired and used reset tokens (for every user)"""
        conn = self.get_connection()
        conn.execute('DELETE FROM password_resets WHERE expires_at <= ? OR used_at IS NOT NULL',
                     (time.time(),))
        conn.commit()
        conn.close()
    
    def create_password_reset(self, user_id, token_hash, ttl_seconds):
        """Store a new token hash for user_id and drop that user's older tokens"""
        now = time.time()
        conn = self.get_connection()
        try:
            conn.execute('DELETE FROM password_resets WHERE user_id = ?', (user_id,))
            conn.execute(
                'INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) '
                'VALUES (?, ?, ?, ?)',
                (user_id, token_hash, now, now + ttl_seconds)
            )
            conn.commit()
        finally:
            conn.close()
    
    def get_valid_password_reset(self, token_hash):
        """The unused, unexpired reset row for this hash, or None"""
        conn = self.get_connection()
        row = conn.execute(
            'SELECT * FROM password_resets '
            'WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
            (token_hash, time.time())
        ).fetchone()
        conn.close()
        return dict(row) if row else None
    
    def use_password_reset(self, reset_id, user_id, password_hash):
        """Atomically: mark the token used (only if still valid), set the password,
        revoke all sessions and delete the user's other tokens. False if the token
        was already used or expired (e.g. a concurrent request won)."""
        now = time.time()
        conn = self.get_connection()
        try:
            cursor = conn.execute(
                'UPDATE password_resets SET used_at = ? '
                'WHERE id = ? AND user_id = ? AND used_at IS NULL AND expires_at > ?',
                (now, reset_id, user_id, now)
            )
            if cursor.rowcount != 1:
                conn.rollback()
                return False
            conn.execute(
                'UPDATE users SET password = ?, session_version = session_version + 1 WHERE id = ?',
                (password_hash, user_id)
            )
            conn.execute('DELETE FROM password_resets WHERE user_id = ? AND id != ?',
                         (user_id, reset_id))
            conn.commit()
            return True
        finally:
            conn.close()
    
    # Login attempt methods (per-email lockout)
    def is_login_locked(self, email):
        cutoff = time.time() - LOGIN_LOCK_WINDOW_SECONDS
        conn = self.get_connection()
        row = conn.execute(
            'SELECT COUNT(*) FROM login_attempts WHERE email = ? AND attempted_at > ?',
            (email, cutoff)
        ).fetchone()
        conn.close()
        return row[0] >= LOGIN_LOCK_MAX_FAILURES
    
    def record_failed_login(self, email):
        now = time.time()
        conn = self.get_connection()
        conn.execute('DELETE FROM login_attempts WHERE attempted_at <= ?',
                     (now - LOGIN_LOCK_WINDOW_SECONDS,))
        conn.execute('INSERT INTO login_attempts (email, attempted_at) VALUES (?, ?)', (email, now))
        conn.commit()
        conn.close()
    
    def clear_failed_logins(self, email):
        conn = self.get_connection()
        conn.execute('DELETE FROM login_attempts WHERE email = ?', (email,))
        conn.commit()
        conn.close()
    
    # Page methods
    def create_page(self, title, content='', user_id=None, parent_id=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO pages (title, content, user_id, parent_id) VALUES (?, ?, ?, ?)',
            (title, content, user_id, parent_id)
        )
        page_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return page_id
    
    def get_page(self, page_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM pages WHERE id = ?', (page_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def get_user_pages(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM pages WHERE user_id = ? ORDER BY updated_at DESC', (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def update_page(self, page_id, title=None, content=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if title is not None:
            cursor.execute(
                'UPDATE pages SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (title, page_id)
            )
        
        if content is not None:
            cursor.execute(
                'UPDATE pages SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (content, page_id)
            )
        
        conn.commit()
        conn.close()
    
    def delete_page(self, page_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM pages WHERE id = ?', (page_id,))
        conn.commit()
        conn.close()
    
    def search_user_pages(self, user_id, query):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM pages WHERE user_id = ? AND title LIKE ? ORDER BY updated_at DESC',
            (user_id, f'%{query}%')
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # Database methods
    def create_database(self, title, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO databases (title, user_id) VALUES (?, ?)',
            (title, user_id)
        )
        database_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return database_id
    
    def get_database(self, database_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM databases WHERE id = ?', (database_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def get_user_databases(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM databases WHERE user_id = ? ORDER BY updated_at DESC', (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def update_database(self, database_id, title=None, view_type=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if title is not None:
            cursor.execute(
                'UPDATE databases SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (title, database_id)
            )
        
        if view_type is not None:
            cursor.execute(
                'UPDATE databases SET view_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (view_type, database_id)
            )
        
        conn.commit()
        conn.close()
    
    def delete_database(self, database_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM databases WHERE id = ?', (database_id,))
        conn.commit()
        conn.close()
    
    # Property methods
    def create_property(self, database_id, name, prop_type, order_index=0, options=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO database_properties (database_id, name, type, order_index, options) VALUES (?, ?, ?, ?, ?)',
            (database_id, name, prop_type, order_index, options)
        )
        prop_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return prop_id
    
    def add_property_to_database(self, database_id, name, prop_type, options=None):
        """Add new property to existing database"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Get max order_index
        cursor.execute(
            'SELECT MAX(order_index) FROM database_properties WHERE database_id = ?',
            (database_id,)
        )
        max_order = cursor.fetchone()[0] or 0
        
        cursor.execute(
            'INSERT INTO database_properties (database_id, name, type, order_index, options) VALUES (?, ?, ?, ?, ?)',
            (database_id, name, prop_type, max_order + 1, options)
        )
        prop_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return prop_id
    
    def delete_property(self, property_id, user_id):
        """Delete a property, only if its database belongs to user_id. Returns True if deleted."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'DELETE FROM database_properties WHERE id = ? '
            'AND database_id IN (SELECT id FROM databases WHERE user_id = ?)',
            (property_id, user_id))
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        return deleted > 0
    
    def get_database_properties(self, database_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM database_properties WHERE database_id = ? ORDER BY order_index',
            (database_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for row in rows:
            prop = dict(row)
            if prop['options']:
                try:
                    prop['options'] = json.loads(prop['options'])
                except:
                    prop['options'] = []
            else:
                prop['options'] = []
            result.append(prop)
        return result
    
    # Item methods
    def create_database_item(self, database_id, properties=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        properties_json = json.dumps(properties if properties else {})
        
        cursor.execute(
            'INSERT INTO database_items (database_id, properties) VALUES (?, ?)',
            (database_id, properties_json)
        )
        item_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return item_id
    
    def get_database_item(self, item_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM database_items WHERE id = ?', (item_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            item = dict(row)
            try:
                item['properties'] = json.loads(item['properties'])
            except:
                item['properties'] = {}
            return item
        return None
    
    def get_database_items(self, database_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM database_items WHERE database_id = ? ORDER BY order_index, id',
            (database_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        
        result = []
        for row in rows:
            item = dict(row)
            try:
                item['properties'] = json.loads(item['properties'])
            except:
                item['properties'] = {}
            result.append(item)
        return result
    
    def update_database_item(self, item_id, properties=None, order_index=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if properties is not None:
            properties_json = json.dumps(properties)
            cursor.execute(
                'UPDATE database_items SET properties = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                (properties_json, item_id)
            )
        
        if order_index is not None:
            cursor.execute(
                'UPDATE database_items SET order_index = ? WHERE id = ?',
                (order_index, item_id)
            )
        
        conn.commit()
        conn.close()
    
    def delete_database_item(self, item_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM database_items WHERE id = ?', (item_id,))
        conn.commit()
        conn.close()
    
    # Tag methods
    def add_tag_to_page(self, page_id, tag_name):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT OR IGNORE INTO tags (name) VALUES (?)', (tag_name,))
        cursor.execute('SELECT id FROM tags WHERE name = ?', (tag_name,))
        tag_id = cursor.fetchone()[0]
        cursor.execute('INSERT OR IGNORE INTO page_tags (page_id, tag_id) VALUES (?, ?)', (page_id, tag_id))
        conn.commit()
        conn.close()
    
    def get_page_tags(self, page_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT tags.name FROM tags
            JOIN page_tags ON tags.id = page_tags.tag_id
            WHERE page_tags.page_id = ?
        ''', (page_id,))
        rows = cursor.fetchall()
        conn.close()
        return [row[0] for row in rows]
    
    def clear_page_tags(self, page_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM page_tags WHERE page_id = ?', (page_id,))
        conn.commit()
        conn.close()

    # Chat methods
    def create_chat(self, user_id, title='New Chat'):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO chat_threads (user_id, title) VALUES (?, ?)',
            (user_id, title)
        )
        chat_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return chat_id

    def get_chat(self, chat_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM chat_threads WHERE id = ?', (chat_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def get_user_chats(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM chat_threads WHERE user_id = ? ORDER BY updated_at DESC',
            (user_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def update_chat_title(self, chat_id, title):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE chat_threads SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (title, chat_id)
        )
        conn.commit()
        conn.close()

    def add_chat_message(self, chat_id, role, content):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)',
            (chat_id, role, content)
        )
        cursor.execute(
            'UPDATE chat_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (chat_id,)
        )
        message_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return message_id

    def get_chat_messages(self, chat_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY id',
            (chat_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
