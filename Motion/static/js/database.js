// Database view management
// Data comes from the JSON block read in main.js (motionData); the CSP blocks inline scripts.
const databaseId = motionData.databaseId;
const properties = motionData.properties || [];
const items = motionData.items || [];

let currentView = 'table';
let currentItems = items || [];
let currentMonth = new Date();

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Database page loaded');
    console.log('Database ID:', databaseId);
    console.log('Items:', currentItems);
    console.log('Properties:', properties);
    
    initializeViewSwitcher();
    initializeAddItem();
    initializeTableView();
    initializeBoardView();
    initializeCalendarView();
    initializeDragAndDrop();
    initializeDatabaseTitle();
    initializeFilters();
    initializeSort();
    initializeAddProperty();
    initializeDeleteDatabase();
    
    // Load initial view
    renderBoardView();
    renderCalendarView();
    renderListView();
});

// Database title auto-save
function initializeDatabaseTitle() {
    const titleInput = document.getElementById('databaseTitle');
    if (!titleInput) return;
    
    let timeout;
    titleInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            fetch(`/api/databases/${databaseId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: titleInput.value })
            }).catch(err => console.error('Error saving title:', err));
        }, 1000);
    });
}

function initializeDeleteDatabase() {
    const deleteBtn = document.getElementById('deleteDatabaseBtn');
    if (!deleteBtn) return;

    deleteBtn.addEventListener('click', async () => {
        if (!confirm('Delete this database and all its items?')) {
            return;
        }

        try {
            const response = await fetch(`/api/databases/${databaseId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete database');
            }
            window.location.href = '/dashboard';
        } catch (error) {
            alert(error.message);
        }
    });
}

// View Switcher
function initializeViewSwitcher() {
    const viewBtns = document.querySelectorAll('.view-btn');
    
    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    currentView = view;
    
    // Update buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Hide all views
    document.querySelectorAll('.database-view').forEach(v => {
        v.classList.remove('active');
    });
    
    // Show selected view
    const viewMap = {
        'table': 'tableView',
        'board': 'boardView',
        'calendar': 'calendarView',
        'list': 'listView'
    };
    
    const viewElement = document.getElementById(viewMap[view]);
    if (viewElement) {
        viewElement.classList.add('active');
    }
    
    // Refresh view
    if (view === 'board') renderBoardView();
    if (view === 'calendar') renderCalendarView();
    if (view === 'list') renderListView();
}

// Table View - Inline Editing
function initializeTableView() {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    
    // Handle cell changes
    tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('cell-input') || e.target.classList.contains('cell-select')) {
            const row = e.target.closest('tr');
            const itemId = row.dataset.itemId;
            const property = e.target.closest('td').dataset.property;
            const value = e.target.value;
            
            updateItemProperty(itemId, property, value);
        }
    });
    
    // Handle delete
    tableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-item')) {
            if (confirm('Delete this item?')) {
                const row = e.target.closest('tr');
                const itemId = row.dataset.itemId;
                deleteItem(itemId).then(() => {
                    row.remove();
                    updateAllViews();
                });
            }
        }
    });
}

// Board View (Kanban)
function initializeBoardView() {
    const addCardBtns = document.querySelectorAll('.add-card-btn');
    
    addCardBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            openAddItemModal(status);
        });
    });
}

function renderBoardView() {
    console.log('Rendering board view');
    
    const statusProp = properties.find(p => p.name === 'Status');
    if (!statusProp || !statusProp.options) return;
    
    // Clear columns
    document.querySelectorAll('.column-items').forEach(col => {
        col.replaceChildren();
    });
    
    // Add cards to columns
    currentItems.forEach(item => {
        const status = item.properties['Status'] || statusProp.options[0];
        const column = document.querySelector(`.column-items[data-status="${CSS.escape(String(status))}"]`);
        
        if (column) {
            const card = createKanbanCard(item);
            column.appendChild(card);
        }
    });
    
    // Update counts
    document.querySelectorAll('.kanban-column').forEach(col => {
        const count = col.querySelectorAll('.kanban-card').length;
        const countEl = col.querySelector('.item-count');
        if (countEl) countEl.textContent = count;
    });
}

function createKanbanCard(item) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.itemId = item.id;
    
    const title = item.properties['Name'] || 'Untitled';
    const priority = item.properties['Priority'] || '';
    const dueDate = item.properties['Due Date'] || '';
    
    card.innerHTML = `
        <div class="card-header">
            <h4>${escapeHtml(title)}</h4>
            ${priority ? `<span class="priority-badge ${cssClass(priority)}">${escapeHtml(priority)}</span>` : ''}
        </div>
        ${dueDate ? `<div class="card-date">📅 ${escapeHtml(formatDate(dueDate))}</div>` : ''}
        <div class="card-actions">
            <button class="card-action-btn delete-card" data-action="delete-card" data-item-id="${Number(item.id)}">🗑️</button>
        </div>
    `;
    
    return card;
}

// Drag and Drop
function initializeDragAndDrop() {
    let draggedCard = null;
    
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            draggedCard = e.target;
            e.target.classList.add('dragging');
        }
    });
    
    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.classList.remove('dragging');
        }
    });
    
    document.querySelectorAll('.column-items').forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });
        
        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });
        
        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            
            if (draggedCard) {
                const newStatus = column.dataset.status;
                const itemId = draggedCard.dataset.itemId;
                
                // Update status
                updateItemProperty(itemId, 'Status', newStatus).then(() => {
                    // Move card visually
                    column.appendChild(draggedCard);
                    
                    // Update counts
                    document.querySelectorAll('.kanban-column').forEach(col => {
                        const count = col.querySelectorAll('.kanban-card').length;
                        const countEl = col.querySelector('.item-count');
                        if (countEl) countEl.textContent = count;
                    });
                });
            }
        });
    });
}

// Calendar View
function initializeCalendarView() {
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            renderCalendarView();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            renderCalendarView();
        });
    }
}

function renderCalendarView() {
    const monthEl = document.getElementById('calendarMonth');
    const gridEl = document.getElementById('calendarGrid');
    
    if (!monthEl || !gridEl) return;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    
    monthEl.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    let html = '<div class="calendar-weekdays">';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        html += `<div class="weekday">${day}</div>`;
    });
    html += '</div><div class="calendar-days">';
    
    // Empty cells
    for (let i = 0; i < startDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // Days
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayItems = currentItems.filter(item => item.properties['Due Date'] === dateStr);
        
        html += `<div class="calendar-day">
            <div class="day-number">${day}</div>
            <div class="day-items">
                ${dayItems.map(item => `
                    <div class="calendar-item">
                        ${escapeHtml(item.properties['Name'] || 'Untitled')}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }
    
    html += '</div>';
    gridEl.innerHTML = html;
}

// List View
function renderListView() {
    const container = document.getElementById('listContainer');
    if (!container) return;
    
    container.innerHTML = currentItems.map(item => {
        const title = item.properties['Name'] || 'Untitled';
        const status = item.properties['Status'] || '';
        const priority = item.properties['Priority'] || '';
        const dueDate = item.properties['Due Date'] || '';
        
        return `
            <div class="list-item" data-item-id="${Number(item.id)}">
                <div class="list-item-main">
                    <input type="checkbox" class="list-checkbox" ${status === 'Done' ? 'checked' : ''}>
                    <span class="list-title">${escapeHtml(title)}</span>
                </div>
                <div class="list-item-meta">
                    ${status ? `<span class="status-badge ${cssClass(status)}">${escapeHtml(status)}</span>` : ''}
                    ${priority ? `<span class="priority-badge ${cssClass(priority)}">${escapeHtml(priority)}</span>` : ''}
                    ${dueDate ? `<span class="date-badge">📅 ${escapeHtml(formatDate(dueDate))}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Add Item Modal
function initializeAddItem() {
    const addBtn = document.getElementById('addItemBtn');
    const form = document.getElementById('addItemForm');
    
    if (addBtn) {
        addBtn.addEventListener('click', () => openAddItemModal());
    }
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const properties = {};
            
            for (let [key, value] of formData.entries()) {
                properties[key] = value;
            }
            
            createItem(properties);
        });
    }
}

function openAddItemModal(defaultStatus = null) {
    const modal = document.getElementById('addItemModal');
    if (!modal) return;
    
    modal.classList.add('active');
    
    if (defaultStatus) {
        const statusSelect = modal.querySelector('select[name="Status"]');
        if (statusSelect) statusSelect.value = defaultStatus;
    }
}

function closeAddItemModal() {
    const modal = document.getElementById('addItemModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addItemForm').reset();
    }
}

// API Functions
async function createItem(properties) {
    try {
        const response = await fetch(`/api/databases/${databaseId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties })
        });
        
        const data = await response.json();
        
        if (data.success && data.item) {
            currentItems.push(data.item);
            closeAddItemModal();
            updateAllViews();
            location.reload(); // Refresh to show in table
        }
    } catch (error) {
        console.error('Error creating item:', error);
        alert('Failed to create item');
    }
}

async function updateItemProperty(itemId, property, value) {
    const item = currentItems.find(i => i.id == itemId);
    if (!item) return;
    
    item.properties[property] = value;
    
    try {
        await fetch(`/api/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: item.properties })
        });
        
        updateAllViews();
    } catch (error) {
        console.error('Error updating item:', error);
    }
}

async function deleteItem(itemId) {
    try {
        await fetch(`/api/items/${itemId}`, {
            method: 'DELETE'
        });
        
        currentItems = currentItems.filter(i => i.id != itemId);
        updateAllViews();
    } catch (error) {
        console.error('Error deleting item:', error);
    }
}

function deleteCardHandler(itemId, event) {
    if (event) event.stopPropagation();
    if (confirm('Delete this card?')) {
        deleteItem(itemId).then(() => {
            location.reload();
        });
    }
}

// Utility Functions
function updateAllViews() {
    if (currentView === 'board') renderBoardView();
    if (currentView === 'calendar') renderCalendarView();
    if (currentView === 'list') renderListView();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// User text -> safe CSS class token (e.g. "In Progress" -> "in-progress").
// escapeHtml() is defined in main.js.
function cssClass(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

// Filter & Sort Functions
let currentFilters = [];

function initializeFilters() {
    const filterBtn = document.getElementById('filterBtn');
    const filterPanel = document.getElementById('filterPanel');
    
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            filterPanel.classList.toggle('active');
            document.getElementById('sortPanel').classList.remove('active');
        });
    }
}

function initializeSort() {
    const sortBtn = document.getElementById('sortBtn');
    const sortPanel = document.getElementById('sortPanel');
    
    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            sortPanel.classList.toggle('active');
            document.getElementById('filterPanel').classList.remove('active');
        });
    }
}

function closeFilterPanel() {
    document.getElementById('filterPanel').classList.remove('active');
}

function closeSortPanel() {
    document.getElementById('sortPanel').classList.remove('active');
}

function addFilterRule() {
    const filterRules = document.getElementById('filterRules');
    const ruleId = Date.now();
    
    const rule = document.createElement('div');
    rule.className = 'filter-rule';
    rule.dataset.ruleId = ruleId;
    
    rule.innerHTML = `
        <div class="filter-rule-row">
            <select class="filter-property">
                <option value="">Select property...</option>
                ${properties.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
            <select class="filter-operator">
                <option value="equals">Equals</option>
                <option value="contains">Contains</option>
                <option value="is_empty">Is empty</option>
                <option value="is_not_empty">Is not empty</option>
            </select>
        </div>
        <div class="filter-rule-row">
            <input type="text" class="filter-value" placeholder="Value...">
            <button type="button" data-action="remove-filter-rule" data-rule-id="${ruleId}">Remove</button>
        </div>
    `;
    
    filterRules.appendChild(rule);
}

function removeFilterRule(ruleId) {
    const rule = document.querySelector(`.filter-rule[data-rule-id="${Number(ruleId)}"]`);
    if (rule) rule.remove();
}

async function applyFilters() {
    const rules = document.querySelectorAll('.filter-rule');
    const filters = [];
    
    rules.forEach(rule => {
        const property = rule.querySelector('.filter-property').value;
        const operator = rule.querySelector('.filter-operator').value;
        const value = rule.querySelector('.filter-value').value;
        
        if (property && operator) {
            filters.push({ property, operator, value });
        }
    });
    
    currentFilters = filters;
    
    try {
        const response = await fetch(`/api/databases/${databaseId}/filter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters })
        });
        
        const data = await response.json();
        currentItems = data.items;
        updateAllViews();
        closeFilterPanel();
        
        alert(`Showing ${data.count} items`);
    } catch (error) {
        console.error('Filter error:', error);
        alert('Failed to apply filters');
    }
}

function clearFilters() {
    currentFilters = [];
    document.getElementById('filterRules').replaceChildren();
    location.reload();
}

async function applySort() {
    const property = document.getElementById('sortProperty').value;
    const order = document.getElementById('sortOrder').value;
    
    if (!property) {
        alert('Please select a property to sort by');
        return;
    }
    
    try {
        const response = await fetch(`/api/databases/${databaseId}/filter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filters: currentFilters,
                sort_by: property,
                sort_order: order
            })
        });
        
        const data = await response.json();
        currentItems = data.items;
        updateAllViews();
        closeSortPanel();
        
        location.reload();
    } catch (error) {
        console.error('Sort error:', error);
        alert('Failed to apply sort');
    }
}

// Add Property Functions
function initializeAddProperty() {
    const addPropertyBtn = document.getElementById('addPropertyBtn');
    const modal = document.getElementById('addPropertyModal');
    const form = document.getElementById('addPropertyForm');
    const typeSelect = document.getElementById('propertyTypeSelect');
    const optionsGroup = document.getElementById('optionsGroup');
    
    if (addPropertyBtn) {
        addPropertyBtn.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }
    
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const needsOptions = ['select', 'multi_select'].includes(e.target.value);
            optionsGroup.style.display = needsOptions ? 'block' : 'none';
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const name = formData.get('name');
            const type = formData.get('type');
            const optionsInput = document.getElementById('propertyOptions').value;
            
            let options = null;
            if (['select', 'multi_select'].includes(type) && optionsInput) {
                options = optionsInput.split(',').map(o => o.trim()).filter(o => o);
            }
            
            try {
                const response = await fetch(`/api/databases/${databaseId}/properties`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, type, options })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    closeAddPropertyModal();
                    location.reload();
                } else {
                    alert('Failed to add property');
                }
            } catch (error) {
                console.error('Add property error:', error);
                alert('Failed to add property');
            }
        });
    }
}

function closeAddPropertyModal() {
    const modal = document.getElementById('addPropertyModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('addPropertyForm').reset();
        document.getElementById('optionsGroup').style.display = 'none';
    }
}

// data-action buttons (dispatched by main.js; the CSP blocks inline onclick)
Object.assign(actionHandlers, {
    'close-item-modal': () => closeAddItemModal(),
    'delete-card': (el, e) => deleteCardHandler(Number(el.dataset.itemId), e),
    'close-filter-panel': () => closeFilterPanel(),
    'close-sort-panel': () => closeSortPanel(),
    'add-filter-rule': () => addFilterRule(),
    'remove-filter-rule': (el) => removeFilterRule(el.dataset.ruleId),
    'apply-filters': () => applyFilters(),
    'clear-filters': () => clearFilters(),
    'apply-sort': () => applySort(),
    'close-property-modal': () => closeAddPropertyModal()
});
