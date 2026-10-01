-- ==========================================================
-- SISTEMA DE GESTIÓN DE RECURSOS HUMANOS - TRÓPICO 56
-- Base de Datos MySQL / SQL DDL
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role ENUM('admin', 'standard') DEFAULT 'standard',
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    base_daily_salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    rfc VARCHAR(13) NOT NULL,
    curp VARCHAR(18),
    nss VARCHAR(11),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    birth_date DATE,
    hire_date DATE NOT NULL,
    department_id INT NOT NULL,
    position_id INT NOT NULL,
    contract_type VARCHAR(50) DEFAULT 'Indeterminado',
    daily_salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    shift VARCHAR(50) DEFAULT 'Matutino',
    entry_time TIME DEFAULT '09:00:00',
    exit_time TIME DEFAULT '17:00:00',
    rest_day VARCHAR(20) DEFAULT 'Domingo',
    status ENUM('active', 'inactive', 'vacation', 'leave') DEFAULT 'active',
    avatar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status ENUM('present', 'late', 'justified_absence', 'unjustified_absence', 'leave', 'vacation', 'early_departure') DEFAULT 'present',
    overtime_hours DECIMAL(4, 2) DEFAULT 0.00,
    overtime_status ENUM('pending', 'approved', 'compensated', 'rejected') DEFAULT 'approved',
    is_holiday_worked TINYINT(1) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_emp_date (employee_id, date),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lft_vacation_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    years_min INT NOT NULL,
    years_max INT NOT NULL,
    vacation_days INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vacation_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INT NOT NULL,
    vacation_pay_percentage DECIMAL(5, 2) DEFAULT 25.00,
    status ENUM('approved', 'pending', 'rejected') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    installments INT DEFAULT 1,
    installment_amount DECIMAL(10, 2) NOT NULL,
    pending_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'in_payroll', 'paid', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payrolls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period_type ENUM('quincenal', 'semanal') DEFAULT 'quincenal',
    period_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('draft', 'closed') DEFAULT 'draft',
    total_perceptions DECIMAL(12, 2) DEFAULT 0.00,
    total_deductions DECIMAL(12, 2) DEFAULT 0.00,
    net_total DECIMAL(12, 2) DEFAULT 0.00,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payroll_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payroll_id INT NOT NULL,
    employee_id INT NOT NULL,
    days_worked DECIMAL(4, 2) DEFAULT 15.00,
    base_salary DECIMAL(10, 2) DEFAULT 0.00,
    overtime_hours DECIMAL(4, 2) DEFAULT 0.00,
    overtime_pay DECIMAL(10, 2) DEFAULT 0.00,
    holidays_worked INT DEFAULT 0,
    holiday_pay DECIMAL(10, 2) DEFAULT 0.00,
    bonus DECIMAL(10, 2) DEFAULT 0.00,
    commissions DECIMAL(10, 2) DEFAULT 0.00,
    vacation_days INT DEFAULT 0,
    vacation_pay DECIMAL(10, 2) DEFAULT 0.00,
    vacation_bonus DECIMAL(10, 2) DEFAULT 0.00,
    christmas_bonus DECIMAL(10, 2) DEFAULT 0.00,
    incident_deductions DECIMAL(10, 2) DEFAULT 0.00,
    tax_deductions DECIMAL(10, 2) DEFAULT 0.00,
    social_security_deductions DECIMAL(10, 2) DEFAULT 0.00,
    other_deductions DECIMAL(10, 2) DEFAULT 0.00,
    total_perceptions DECIMAL(10, 2) DEFAULT 0.00,
    total_deductions DECIMAL(10, 2) DEFAULT 0.00,
    net_pay DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('draft', 'approved') DEFAULT 'draft',
    notes TEXT,
    FOREIGN KEY (payroll_id) REFERENCES payrolls(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_settings (
    key_name VARCHAR(50) PRIMARY KEY,
    value_text TEXT NOT NULL
);
