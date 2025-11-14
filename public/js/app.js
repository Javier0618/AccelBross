const API_URL = '/api';
let currentUser = null;
let currentPage = 'dashboard';

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Autenticación
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/auth.php`);
        const result = await response.json();
        
        if (result.success) {
            currentUser = result.user;
            showApp();
            loadPage('dashboard');
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
}

async function login(email, password) {
    try {
        const response = await fetch(`${API_URL}/auth.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = result.user;
            showApp();
            loadPage('dashboard');
        } else {
            document.getElementById('loginError').textContent = result.message;
        }
    } catch (error) {
        document.getElementById('loginError').textContent = 'Error de conexión';
    }
}

async function logout() {
    await fetch(`${API_URL}/auth.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
    });
    
    currentUser = null;
    showLogin();
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    renderSidebar();
    updateUserDisplay();
}

// UI
function renderSidebar() {
    const nav = document.getElementById('sidebarNav');
    const items = [
        { title: 'Dashboard', icon: 'chart-line', page: 'dashboard' },
        { title: 'Productos', icon: 'box', page: 'products' },
        { title: 'Ventas', icon: 'cash-register', page: 'sales' },
        { title: 'Clientes', icon: 'users', page: 'customers' },
        { title: 'Compras', icon: 'shopping-cart', page: 'purchases' },
        { title: 'Proveedores', icon: 'truck', page: 'suppliers' },
        { title: 'Gastos', icon: 'money-bill-wave', page: 'expenses' },
        { title: 'Cuentas por Cobrar', icon: 'hand-holding-usd', page: 'receivable' },
        { title: 'Cuentas por Pagar', icon: 'file-invoice-dollar', page: 'payable' },
        { title: 'Reporte de Caja', icon: 'cash-register', page: 'cashreport' },
        { title: 'Reportes', icon: 'chart-bar', page: 'reports' },
        { title: 'Configuración', icon: 'cog', page: 'settings' }
    ];
    
    nav.innerHTML = items.map(item => `
        <div class="nav-item" data-page="${item.page}">
            <i class="fas fa-${item.icon}"></i>
            <span>${item.title}</span>
        </div>
    `).join('');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            loadPage(item.dataset.page);
        });
    });
}

function updateUserDisplay() {
    if (currentUser) {
        document.getElementById('userAvatar').textContent = currentUser.username?.charAt(0).toUpperCase() || 'U';
        document.getElementById('userName').textContent = currentUser.username || currentUser.email;
    }
}

async function loadPage(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    const titles = {
        dashboard: 'Dashboard',
        products: 'Productos',
        sales: 'Ventas',
        customers: 'Clientes',
        purchases: 'Compras',
        suppliers: 'Proveedores',
        expenses: 'Gastos',
        receivable: 'Cuentas por Cobrar',
        payable: 'Cuentas por Pagar',
        cashreport: 'Reporte de Caja',
        reports: 'Reportes',
        settings: 'Configuración'
    };
    
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
    
    const contentArea = document.getElementById('contentArea');
    
    switch(page) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'products':
            await loadProducts();
            break;
        case 'sales':
            await loadSales();
            break;
        case 'customers':
            await loadCustomers();
            break;
        default:
            contentArea.innerHTML = '<p>Página en desarrollo...</p>';
    }
}

// Dashboard
async function loadDashboard() {
    const [salesRes, productsRes, purchasesRes, expensesRes] = await Promise.all([
        fetch(`${API_URL}/sales.php`),
        fetch(`${API_URL}/products.php`),
        fetch(`${API_URL}/purchases.php`),
        fetch(`${API_URL}/expenses.php`)
    ]);
    
    const sales = (await salesRes.json()).data || [];
    const products = (await productsRes.json()).data || [];
    const purchases = (await purchasesRes.json()).data || [];
    const expenses = (await expensesRes.json()).data || [];
    
    const totalSales = sales.filter(s => s.payment_status !== 'credit').reduce((sum, s) => sum + parseFloat(s.total), 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + parseFloat(p.total), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const totalStock = products.reduce((sum, p) => sum + parseInt(p.stock), 0);
    
    const content = `
        <div class="metrics-grid">
            <div class="metric-card">
                <i class="fas fa-dollar-sign" style="font-size:2rem;"></i>
                <div class="metric-value">${formatCurrency(totalSales)}</div>
                <div>Ventas Totales</div>
            </div>
            <div class="metric-card">
                <i class="fas fa-shopping-bag" style="font-size:2rem;"></i>
                <div class="metric-value">${formatCurrency(totalPurchases)}</div>
                <div>Costo Compras</div>
            </div>
            <div class="metric-card">
                <i class="fas fa-chart-line" style="font-size:2rem;"></i>
                <div class="metric-value">${formatCurrency(totalSales - totalPurchases - totalExpenses)}</div>
                <div>Beneficio Neto</div>
            </div>
            <div class="metric-card">
                <i class="fas fa-boxes" style="font-size:2rem;"></i>
                <div class="metric-value">${totalStock}</div>
                <div>Stock Total</div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3>Productos con Stock Bajo</h3>
            </div>
            <div class="card-body">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>SKU</th>
                            <th>Stock</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.filter(p => p.stock <= 5).map(p => `
                            <tr>
                                <td>${p.name}</td>
                                <td>${p.sku}</td>
                                <td><strong>${p.stock}</strong></td>
                            </tr>
                        `).join('') || '<tr><td colspan="3">No hay alertas de stock</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('contentArea').innerHTML = content;
}

// Productos
async function loadProducts() {
    const response = await fetch(`${API_URL}/products.php`);
    const result = await response.json();
    const products = result.data || [];
    
    const content = `
        <div class="card">
            <div class="card-header">
                <h3>Gestión de Productos</h3>
                <button class="btn btn-primary" onclick="openProductModal()">
                    <i class="fas fa-plus"></i> Nuevo Producto
                </button>
            </div>
            <div class="card-body">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>SKU</th>
                            <th>Categoría</th>
                            <th>Stock</th>
                            <th>Precio</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => `
                            <tr>
                                <td><strong>${p.name}</strong></td>
                                <td><code>${p.sku}</code></td>
                                <td>${p.category}</td>
                                <td>${p.stock}</td>
                                <td><strong>${formatCurrency(p.sell_price)}</strong></td>
                                <td>
                                    <button class="btn btn-outline btn-sm" onclick="editProduct('${p.id}')">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-destructive btn-sm" onclick="deleteProduct('${p.id}')">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('contentArea').innerHTML = content;
}

// Helpers
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(amount);
}

function showModal(title, body, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modal').style.display = 'flex';
    
    document.getElementById('modalConfirm').onclick = onConfirm;
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        login(email, password);
    });
    
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    document.getElementById('modalCancel')?.addEventListener('click', closeModal);
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
}
