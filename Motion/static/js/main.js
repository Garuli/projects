// Server-rendered page data. It lives in a <script type="application/json">
// block because the Content-Security-Policy blocks inline scripts.
const motionData = (() => {
    const el = document.getElementById('motion-data');
    try {
        return el ? JSON.parse(el.textContent) : {};
    } catch (e) {
        return {};
    }
})();
const pageId = motionData.pageId; // undefined outside the page editor

// Global variables
let autoSaveTimeout = null;
let currentPageId = null;

// Click actions. The CSP blocks inline onclick="" handlers, so buttons carry
// data-action="name" and are dispatched here. Other scripts add their own.
const actionHandlers = {
    'new-page': () => createNewPage(),
    'new-database': () => createNewDatabase(),
    'open-chat': (el) => { window.location.href = el.dataset.href; },
    'toggle-preview': () => togglePreview(),
    'ai-improve': () => aiImprove()
};

document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && actionHandlers[el.dataset.action]) {
        actionHandlers[el.dataset.action](el, e);
    }
});

// Escape text for safe insertion into HTML (element content or quoted attributes)
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeEventListeners();
    
    // Check if we're on a page view
    if (pageId !== undefined) {
        currentPageId = pageId;
        initializeEditor();
    }
});

// Theme Management
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '☀️';
    }
    
    themeToggle.addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const themeToggle = document.getElementById('themeToggle');
    document.body.classList.toggle('dark-mode');
    
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        themeToggle.textContent = '☀️';
    } else {
        localStorage.setItem('theme', 'light');
        themeToggle.textContent = '🌙';
    }
}

// Event Listeners
function initializeEventListeners() {
    // New page button
    const newPageBtn = document.getElementById('newPageBtn');
    if (newPageBtn) {
        newPageBtn.addEventListener('click', createNewPage);
    }
    
    // New database button
    const newDatabaseBtn = document.getElementById('newDatabaseBtn');
    if (newDatabaseBtn) {
        newDatabaseBtn.addEventListener('click', createNewDatabase);
    }
    
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                document.getElementById('searchResults').classList.remove('active');
            }, 200);
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Editor Initialization
function initializeEditor() {
    const editor = document.getElementById('editor');
    const titleInput = document.getElementById('pageTitle');
    const tagsInput = document.getElementById('tagsInput');
    const deleteBtn = document.getElementById('deleteBtn');
    const exportBtn = document.getElementById('exportBtn');
    
    if (editor) {
        editor.addEventListener('input', () => {
            autoSave('content', editor.value);
        });
    }
    
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            autoSave('title', titleInput.value);
        });
    }
    
    if (tagsInput) {
        tagsInput.addEventListener('blur', saveTags);
        tagsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveTags();
            }
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deletePage);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportPage);
    }
}

// Auto-save functionality
function autoSave(field, value) {
    const indicator = document.getElementById('saveIndicator');
    
    if (indicator) {
        indicator.textContent = 'Saving...';
        indicator.classList.add('saving');
    }
    
    clearTimeout(autoSaveTimeout);
    
    autoSaveTimeout = setTimeout(() => {
        const data = {};
        data[field] = value;
        
        fetch(`/api/pages/${currentPageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(() => {
            if (indicator) {
                indicator.textContent = 'Saved';
                indicator.classList.remove('saving');
            }
            
            // Update sidebar title if needed
            if (field === 'title') {
                updateSidebarTitle(currentPageId, value);
            }
        })
        .catch(error => {
            console.error('Save error:', error);
            if (indicator) {
                indicator.textContent = 'Error saving';
                indicator.classList.remove('saving');
            }
        });
    }, 1000);
}

// Update sidebar page title
function updateSidebarTitle(pageId, newTitle) {
    const pageItem = document.querySelector(`[data-page-id="${pageId}"] .page-title`);
    if (pageItem) {
        pageItem.textContent = newTitle;
    }
}

// Tags Management
function saveTags() {
    const tagsInput = document.getElementById('tagsInput');
    const tagsDisplay = document.getElementById('tagsDisplay');
    
    const tagsText = tagsInput.value;
    const tags = tagsText.split(',').map(t => t.trim()).filter(t => t);
    
    fetch(`/api/pages/${currentPageId}/tags`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags })
    })
    .then(response => response.json())
    .then(() => {
        // Update display
        tagsDisplay.replaceChildren(...tags.map(tag => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.textContent = tag;
            return span;
        }));
        
        tagsInput.value = '';
    })
    .catch(error => console.error('Error saving tags:', error));
}

// Preview Toggle
function togglePreview() {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    
    if (preview.classList.contains('hidden')) {
        // Show preview
        preview.classList.remove('hidden');
        editor.style.display = 'none';
        // parseMarkdown escapes all HTML first, so this is safe
        preview.innerHTML = parseMarkdown(editor.value);
    } else {
        // Show editor
        preview.classList.add('hidden');
        editor.style.display = 'block';
    }
}

// Simple Markdown Parser
// Escapes the input first, so the only HTML in the output is what these rules
// generate. Links are limited to http, https and mailto.
function parseMarkdown(text) {
    let html = escapeHtml(text);
    
    // Code blocks (multiline)
    html = html.replace(/```(\w+)?\r?\n([\s\S]*?)\r?\n```/g, '<pre><code>$2</code></pre>');
    // Code blocks (single-line)
    html = html.replace(/```([^`\r\n]+)```/g, '<pre><code>$1</code></pre>');
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Checkboxes
    html = html.replace(/- \[ \] (.*$)/gim, '<input type="checkbox" disabled> $1<br>');
    html = html.replace(/- \[x\] (.*$)/gim, '<input type="checkbox" checked disabled> $1<br>');
    
    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    
    // Tables (basic support)
    html = html.replace(/\|(.+)\|\r?\n\|[-:\s|]+\|\r?\n((?:\|.+\|\r?\n?)*)/g, (match, header, rows) => {
        const headerCells = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
        const rowsHtml = rows.trim().split('\n').map(row => {
            const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        
        return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
    });
    
    // Tables (single-line)
    html = html.replace(/^\|(.+)\|$/gm, (match, row) => {
        const cells = row.split('|').filter(c => c.trim());
        if (cells.length < 2) {
            return match;
        }
        const rowHtml = cells.map(c => `<td>${c.trim()}</td>`).join('');
        return `<table><tbody><tr>${rowHtml}</tr></tbody></table>`;
    });
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        url = url.trim();
        // Escaped text can't contain < > or ", so if any are present the URL
        // picked up markup from an earlier rule. Leave it as plain text.
        if (!/^(https?:|mailto:)/i.test(url) || /[<>"]/.test(url)) {
            return match;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// Search Functionality
function handleSearch(e) {
    const query = e.target.value.trim();
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query) {
        resultsDiv.classList.remove('active');
        return;
    }
    
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(results => {
            resultsDiv.replaceChildren();
            if (results.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'search-result-item';
                empty.textContent = 'No results found';
                resultsDiv.appendChild(empty);
            } else {
                results.forEach(page => {
                    const row = document.createElement('div');
                    row.className = 'search-result-item';
                    row.textContent = `📄 ${page.title}`;
                    row.addEventListener('click', () => {
                        window.location.href = `/page/${Number(page.id)}`;
                    });
                    resultsDiv.appendChild(row);
                });
            }
            resultsDiv.classList.add('active');
        })
        .catch(error => console.error('Search error:', error));
}

// Create New Page
function createNewPage() {
    fetch('/api/pages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: 'Untitled',
            content: ''
        })
    })
    .then(response => response.json())
    .then(data => {
        window.location.href = `/page/${data.id}`;
    })
    .catch(error => console.error('Error creating page:', error));
}

// Create New Database
function createNewDatabase() {
    fetch('/api/databases', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: 'Untitled Database'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.id) {
            window.location.href = `/database/${data.id}`;
        }
    })
    .catch(error => console.error('Error creating database:', error));
}

// Make functions global
window.createNewPage = createNewPage;
window.createNewDatabase = createNewDatabase;

// AI Features
function initializeAIFeatures() {
    const aiMenuBtn = document.getElementById('aiMenuBtn');
    const aiMenu = document.getElementById('aiMenu');
    
    if (aiMenuBtn && aiMenu) {
        aiMenuBtn.addEventListener('click', () => {
            aiMenu.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!aiMenuBtn.contains(e.target) && !aiMenu.contains(e.target)) {
                aiMenu.classList.remove('active');
            }
        });
    }
}

async function aiImprove() {
    const editor = document.getElementById('editor');
    if (!editor) return;
    
    const content = editor.value;
    if (!content) {
        alert('Please write something first.');
        return;
    }
    
    try {
        const response = await fetch('/api/ai/improve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (confirm('Replace current text with improved version?')) {
                editor.value = data.improved;
                // Trigger auto-save
                editor.dispatchEvent(new Event('input'));
            }
        } else {
            alert(data.error || 'Failed to improve text');
        }
    } catch (error) {
        console.error('AI Improve error:', error);
        alert('Failed to improve text');
    }
}

// Initialize AI features if on page edit view
if (pageId !== undefined) {
    initializeAIFeatures();
}

// Make AI functions global
window.aiImprove = aiImprove;

// Delete Page
function deletePage() {
    if (!confirm('Are you sure you want to delete this page?')) {
        return;
    }
    
    fetch(`/api/pages/${currentPageId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(() => {
        window.location.href = '/';
    })
    .catch(error => console.error('Error deleting page:', error));
}

// Export Page
function exportPage() {
    window.location.href = `/api/export/${currentPageId}`;
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + D: Toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
    }
    
    // Ctrl/Cmd + N: New page
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewPage();
    }
    
    // Ctrl/Cmd + P: Toggle preview
    if ((e.ctrlKey || e.metaKey) && e.key === 'p' && currentPageId) {
        e.preventDefault();
        togglePreview();
    }
    
    // Ctrl/Cmd + E: Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e' && currentPageId) {
        e.preventDefault();
        exportPage();
    }
    
    // Ctrl/Cmd + K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
