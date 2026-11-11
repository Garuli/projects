from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash
from database import Database
import os
from functools import wraps
import re
import json
import urllib.request as urlrequest
import urllib.error as urlerror

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'motion-secret-key-2025')

# Initialize database
db = Database()

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('landing'))
        return f(*args, **kwargs)
    return decorated_function

# Password validation
def validate_password(password):
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
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('landing.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()
        
        if not email or not password or not name:
            return jsonify({'success': False, 'message': 'All fields required'}), 400
        
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            return jsonify({'success': False, 'message': 'Invalid email'}), 400
        
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'success': False, 'message': message}), 400
        
        if db.get_user_by_email(email):
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        user_id = db.create_user(email, password, name)
        
        if user_id:
            session['user_id'] = user_id
            session['user_email'] = email
            session['user_name'] = name
            return jsonify({'success': True})
        
        return jsonify({'success': False, 'message': 'Registration failed'}), 500
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password required'}), 400
        
        user = db.verify_user(email, password)
        
        if user:
            session['user_id'] = user['id']
            session['user_email'] = user['email']
            session['user_name'] = user['name']
            return jsonify({'success': True})
        
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    
    return render_template('login.html')

@app.route('/logout')
def logout():
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
        data = request.json or {}
        title = data.get('title', 'New Chat').strip() or 'New Chat'
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

    data = request.json or {}
    content = data.get('message', '').strip()
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
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# API - Pages
@app.route('/api/pages', methods=['GET', 'POST'])
@login_required
def api_pages():
    if request.method == 'POST':
        data = request.json
        title = data.get('title', 'Untitled')
        content = data.get('content', '')
        
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
        data = request.json
        db.update_page(page_id, data.get('title'), data.get('content'))
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
    
    data = request.json
    tags = data.get('tags', [])
    
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
        data = request.json
        title = data.get('title', 'Untitled Database')
        
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
        data = request.json
        db.update_database(database_id, data.get('title'), data.get('view_type'))
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
    
    data = request.json
    properties = data.get('properties', {})
    
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
        data = request.json
        db.update_database_item(item_id, data.get('properties'), data.get('order'))
        updated_item = db.get_database_item(item_id)
        return jsonify({'success': True, 'item': updated_item})
    
    elif request.method == 'DELETE':
        db.delete_database_item(item_id)
        return jsonify({'success': True})
@app.route('/api/search')
@login_required
def api_search():
    query = request.args.get('q', '')
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
    data = request.json or {}
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'error': 'No content provided'}), 400

    try:
        improved = improve_text_with_ollama(content)
        return jsonify({'success': True, 'improved': improved})
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/<int:page_id>')
@login_required
def api_export(page_id):
    page = db.get_page(page_id)
    
    if not page or page['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    markdown = f"# {page['title']}\n\n{page['content']}"
    
    from flask import Response
    return Response(
        markdown,
        mimetype='text/markdown',
        headers={'Content-Disposition': f'attachment; filename={page["title"]}.md'}
    )

# Property Management Routes
@app.route('/api/databases/<int:database_id>/properties', methods=['POST'])
@login_required
def api_add_property(database_id):
    """Add new property to database"""
    database = db.get_database(database_id)
    if not database or database['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    data = request.json
    name = data.get('name', 'New Property')
    prop_type = data.get('type', 'text')
    options = data.get('options')
    
    if options:
        options = json.dumps(options)
    
    prop_id = db.add_property_to_database(database_id, name, prop_type, options)
    return jsonify({'id': prop_id, 'success': True})

@app.route('/api/properties/<int:property_id>', methods=['DELETE'])
@login_required
def api_delete_property(property_id):
    """Delete a property"""
    
    db.delete_property(property_id, session['user_id'])
    return jsonify({'success': True})

# Filter & Sort Routes
@app.route('/api/databases/<int:database_id>/filter', methods=['POST'])
@login_required
def api_filter_items(database_id):
    """Filter database items"""
    database = db.get_database(database_id)
    if not database or database['user_id'] != session['user_id']:
        return jsonify({'error': 'Not found'}), 404
    
    data = request.json
    filters = data.get('filters', [])
    sort_by = data.get('sort_by')
    sort_order = data.get('sort_order', 'asc')
    
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
                            if value.lower() in str(item['properties'].get(property_name, '')).lower()]
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
            key=lambda x: x['properties'].get(sort_by, ''),
            reverse=reverse
        )
    
    return jsonify({'items': filtered_items, 'count': len(filtered_items)})


if __name__ == '__main__':
    # 5000 is taken by macOS AirPlay Receiver, so default to 5001
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
