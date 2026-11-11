import sqlite3
from datetime import datetime
import hashlib
import os
import json

class Database:
    def __init__(self, db_name='motion.db'):
        self.db_name = db_name
        self.init_db()
    
    def get_connection(self):
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        return conn
    
    def hash_password(self, password):
        salt = os.urandom(32)
        pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return salt + pwdhash
    
    def verify_password(self, stored_password, provided_password):
        salt = stored_password[:32]
        stored_hash = stored_password[32:]
        pwdhash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
        return pwdhash == stored_hash
    
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
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
        if user and self.verify_password(user['password'], password):
            return user
        return None
    
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
        """Delete a property, only if its database belongs to user_id"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'DELETE FROM database_properties WHERE id = ? '
            'AND database_id IN (SELECT id FROM databases WHERE user_id = ?)',
            (property_id, user_id))
        conn.commit()
        conn.close()
    
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
