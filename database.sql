-- Tabla de usuarios
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    role ENUM('Admin', 'Ventas', 'Bodeguero') DEFAULT 'Ventas',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Tabla de productos
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    category ENUM('Celulares', 'Accesorios', 'Cargadores', 'Fundas', 'Audífonos', 'Cables', 'Power Banks', 'Soportes', 'Protectores', 'Otros') DEFAULT 'Otros',
    stock INT DEFAULT 0,
    sell_price DECIMAL(15,2) NOT NULL,
    cost_price DECIMAL(15,2) DEFAULT 0,
    avg_cost_price DECIMAL(15,2) DEFAULT 0,
    image VARCHAR(500),
    description TEXT,
    imeis JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    INDEX idx_sku (sku),
    INDEX idx_category (category),
    INDEX idx_stock (stock)
);

-- Tabla de clientes
CREATE TABLE customers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    document VARCHAR(100),
    address TEXT,
    notes TEXT,
    total_purchases DECIMAL(15,2) DEFAULT 0,
    last_purchase TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    INDEX idx_phone (phone),
    INDEX idx_email (email)
);

-- Tabla de ventas
CREATE TABLE sales (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    customer_email VARCHAR(255),
    customer_address TEXT,
    sale_date DATE NOT NULL,
    items JSON NOT NULL,
    imeis_sold JSON,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 19,
    tax DECIMAL(15,2) DEFAULT 0,
    discount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    payment_status ENUM('paid', 'pending', 'credit') DEFAULT 'paid',
    payment_method ENUM('efectivo', 'tarjeta', 'transferencia', 'nequi', 'daviplata', 'otro') DEFAULT 'efectivo',
    credit_due_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    INDEX idx_customer (customer_id),
    INDEX idx_date (sale_date),
    INDEX idx_payment_status (payment_status)
);

-- Tabla de proveedores
CREATE TABLE suppliers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    nit VARCHAR(100) UNIQUE NOT NULL,
    contact VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(500),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    INDEX idx_nit (nit)
);

-- Tabla de compras
CREATE TABLE purchases (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    supplier_id VARCHAR(36) NOT NULL,
    purchase_date DATE NOT NULL,
    items JSON NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    note TEXT,
    payment_status ENUM('paid', 'pending') DEFAULT 'paid',
    due_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    INDEX idx_supplier (supplier_id),
    INDEX idx_date (purchase_date)
);

-- Tabla de gastos
CREATE TABLE expenses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    concept VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category ENUM('Arriendo', 'Servicios', 'Sueldos', 'Publicidad', 'Transporte', 'Mantenimiento', 'Otros') DEFAULT 'Otros',
    expense_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    INDEX idx_date (expense_date),
    INDEX idx_category (category)
);

-- Tabla de cuentas por cobrar
CREATE TABLE accounts_receivable (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    sale_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    pending_amount DECIMAL(15,2) NOT NULL,
    payments JSON,
    due_date DATE NOT NULL,
    status ENUM('pending', 'paid') DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    INDEX idx_status (status),
    INDEX idx_customer (customer_id)
);

-- Tabla de cuentas por pagar
CREATE TABLE accounts_payable (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    purchase_id VARCHAR(36) NOT NULL,
    supplier_id VARCHAR(36) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending', 'paid') DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    INDEX idx_status (status),
    INDEX idx_supplier (supplier_id)
);

-- Tabla de configuración
CREATE TABLE settings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    company_name VARCHAR(255) DEFAULT 'AccelBross',
    company_nit VARCHAR(100),
    company_address TEXT,
    logo_url VARCHAR(500),
    tax_rate DECIMAL(5,2) DEFAULT 19.00,
    currency ENUM('COP', 'USD', 'EUR') DEFAULT 'COP',
    min_stock INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar usuario administrador por defecto
INSERT INTO users (email, password_hash, username, role) 
VALUES ('javiervelasquez0618@gmail.com', '$2y$10$YourHashedPasswordHere', 'admin', 'Admin');

-- Insertar configuración por defecto
INSERT INTO settings (company_name, company_nit, tax_rate, currency, min_stock)
VALUES ('AccelBross', '987654321', 19.00, 'COP', 5);