const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

let pool = null;

// LFT vacation table initial rules
const defaultLftRules = [
    { years_min: 1, years_max: 1, vacation_days: 12 },
    { years_min: 2, years_max: 2, vacation_days: 14 },
    { years_min: 3, years_max: 3, vacation_days: 16 },
    { years_min: 4, years_max: 4, vacation_days: 18 },
    { years_min: 5, years_max: 5, vacation_days: 20 },
    { years_min: 6, years_max: 10, vacation_days: 22 },
    { years_min: 11, years_max: 15, vacation_days: 24 },
    { years_min: 16, years_max: 20, vacation_days: 26 },
    { years_min: 21, years_max: 25, vacation_days: 28 },
    { years_min: 26, years_max: 30, vacation_days: 30 },
    { years_min: 31, years_max: 35, vacation_days: 32 }
];

// Helper to run query via MySQL pool
async function query(sql, params = []) {
    if (!pool) {
        throw new Error('La conexión con MySQL no está disponible. Asegúrese de que el servidor MySQL esté activo.');
    }
    const [rows] = await pool.query(sql, params);
    if (rows && typeof rows.insertId !== 'undefined') {
        return { insertId: rows.insertId, affectedRows: rows.affectedRows, rows };
    }
    return rows;
}

async function initDatabase() {
    console.log('🔄 Conectando al servidor MySQL...');
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306');
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'tropico56_sgrh';

    try {
        // 1. Conexión directa inicial para garantizar que la base de datos exista
        const connection = await mysql.createConnection({ host, port, user, password });
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await connection.end();

        // 2. Crear el Pool de conexiones a MySQL
        pool = mysql.createPool({
            host,
            port,
            user,
            password,
            database,
            waitForConnections: true,
            connectionLimit: 15,
            queueLimit: 0,
            dateStrings: true
        });

        // 3. Probar conexión activa del pool
        const connTest = await pool.getConnection();
        connTest.release();
        console.log(`✅ Base de datos MySQL conectada exitosamente (${host}:${port}/${database})`);

        // 4. Crear tablas e inicializar datos si es necesario
        await createTables();
        await seedInitialData();
    } catch (mysqlError) {
        console.error(`❌ Error crítico: No se pudo conectar a la base de datos MySQL (${host}:${port}/${database}).`);
        console.error(`   Detalle del error: ${mysqlError.message}`);
        console.error('   Asegúrate de que el servicio MySQL esté ejecutándose y las credenciales en .env sean correctas.');
        throw mysqlError;
    }
}

async function createTables() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL UNIQUE,
            role ENUM('admin', 'standard') DEFAULT 'standard',
            active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS departments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS positions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            department_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            base_daily_salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            description TEXT,
            active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_positions_dept (department_id),
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS employees (
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
            status ENUM('active', 'inactive', 'vacation', 'leave') DEFAULT 'active',
            avatar VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_emp_dept (department_id),
            INDEX idx_emp_pos (position_id),
            INDEX idx_emp_status (status),
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
            FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS attendance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            date DATE NOT NULL,
            check_in TIME,
            check_out TIME,
            status ENUM('present', 'late', 'justified_absence', 'unjustified_absence', 'leave', 'vacation', 'early_departure') DEFAULT 'present',
            overtime_hours DECIMAL(4, 2) DEFAULT 0.00,
            is_holiday_worked TINYINT(1) DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_emp_date (employee_id, date),
            INDEX idx_att_date (date),
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS lft_vacation_rules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            years_min INT NOT NULL,
            years_max INT NOT NULL,
            vacation_days INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS vacation_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            days_requested INT NOT NULL,
            vacation_pay_percentage DECIMAL(5, 2) DEFAULT 25.00,
            status ENUM('approved', 'pending', 'rejected') DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_vac_emp (employee_id),
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS incidents (
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
            INDEX idx_inc_emp (employee_id),
            INDEX idx_inc_status (status),
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS payrolls (
            id INT AUTO_INCREMENT PRIMARY KEY,
            period_type VARCHAR(50) DEFAULT 'quincenal',
            period_name VARCHAR(100) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            status VARCHAR(50) DEFAULT 'draft',
            total_perceptions DECIMAL(12, 2) DEFAULT 0.00,
            total_deductions DECIMAL(12, 2) DEFAULT 0.00,
            net_total DECIMAL(12, 2) DEFAULT 0.00,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            closed_at TIMESTAMP NULL,
            INDEX idx_pay_dates (start_date, end_date),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS payroll_details (
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
            status VARCHAR(50) DEFAULT 'draft',
            notes TEXT,
            INDEX idx_pd_payroll (payroll_id),
            INDEX idx_pd_emp (employee_id),
            FOREIGN KEY (payroll_id) REFERENCES payrolls(id) ON DELETE CASCADE,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

        `CREATE TABLE IF NOT EXISTS system_settings (
            key_name VARCHAR(50) PRIMARY KEY,
            value_text TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (const q of queries) {
        await query(q);
    }
}

async function seedInitialData() {
    // 1. Check & Seed Settings
    const settings = await query("SELECT * FROM system_settings WHERE key_name = 'restaurant_name'");
    if (settings.length === 0) {
        await query("INSERT INTO system_settings (key_name, value_text) VALUES ('restaurant_name', 'Trópico 56')");
        await query("INSERT INTO system_settings (key_name, value_text) VALUES ('restaurant_rfc', 'TRO220815XYZ')");
        await query("INSERT INTO system_settings (key_name, value_text) VALUES ('vacation_bonus_pct', '25.00')");
        await query("INSERT INTO system_settings (key_name, value_text) VALUES ('christmas_bonus_days', '15')");
        await query("INSERT INTO system_settings (key_name, value_text) VALUES ('currency', 'MXN')");
    }

    // 2. Check & Seed LFT Rules
    const lftCount = await query("SELECT COUNT(*) as count FROM lft_vacation_rules");
    const lftNum = lftCount[0]?.count || 0;
    if (lftNum === 0) {
        for (const rule of defaultLftRules) {
            await query("INSERT INTO lft_vacation_rules (years_min, years_max, vacation_days) VALUES (?, ?, ?)", [
                rule.years_min,
                rule.years_max,
                rule.vacation_days
            ]);
        }
    }

    // 3. Check & Seed Users (Admin and Standard)
    const userCount = await query("SELECT COUNT(*) as count FROM users");
    const userNum = userCount[0]?.count || 0;
    if (userNum === 0) {
        const salt = await bcrypt.genSalt(10);
        const adminPass = await bcrypt.hash('admin123', salt);
        const standardPass = await bcrypt.hash('tropico123', salt);

        await query(
            "INSERT INTO users (username, password_hash, full_name, email, role, active) VALUES (?, ?, ?, ?, ?, ?)",
            ['admin', adminPass, 'Administrador Trópico 56', 'admin@tropico56.com', 'admin', 1]
        );

        await query(
            "INSERT INTO users (username, password_hash, full_name, email, role, active) VALUES (?, ?, ?, ?, ?, ?)",
            ['estandar', standardPass, 'Operador Estándar RH', 'operador@tropico56.com', 'standard', 1]
        );
    }

    // 4. Check & Seed Departments & Positions
    const deptCount = await query("SELECT COUNT(*) as count FROM departments");
    if ((deptCount[0]?.count || 0) === 0) {
        const depts = [
            { name: 'Cocina', desc: 'Área de preparación de alimentos calientes, fríos y repostería' },
            { name: 'Servicio y Salón', desc: 'Atención directa al comensal, servicio de mesas y capitanes' },
            { name: 'Barra y Coctelería', desc: 'Preparación de bebidas tropicales, licores y mixología' },
            { name: 'Administración', desc: 'Gerencia, caja, compras y recursos humanos' },
            { name: 'Steward y Limpieza', desc: 'Higiene de instalaciones, loza y cristalería' }
        ];

        for (const d of depts) {
            const res = await query("INSERT INTO departments (name, description) VALUES (?, ?)", [d.name, d.desc]);
            const deptId = res.insertId;

            if (d.name === 'Cocina') {
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Chef Ejecutivo', 850.00, 'Líder de cocina y diseño de menú']);
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Cocinero A', 480.00, 'Responsable de línea caliente']);
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Ayudante de Cocina', 350.00, 'Mise en place y soporte']);
            } else if (d.name === 'Servicio y Salón') {
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Capitán de Meseros', 520.00, 'Supervisión de sala y comensales']);
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Mesero / Host', 340.00, 'Atención a comensales y comandas']);
            } else if (d.name === 'Barra y Coctelería') {
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Bartender / Mixólogo', 450.00, 'Elaboración de cócteles insignia']);
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Barback / Ayudante de Barra', 320.00, 'Abastecimiento de hielo, fruta y licores']);
            } else if (d.name === 'Administración') {
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Gerente de Sucursal', 900.00, 'Operación integral del restaurante']);
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Cajero General', 380.00, 'Cobros, cortes y arqueos de caja']);
            } else if (d.name === 'Steward y Limpieza') {
                await query("INSERT INTO positions (department_id, name, base_daily_salary, description) VALUES (?, ?, ?, ?)", [deptId, 'Steward / Lava Loza', 320.00, 'Lavado de loza, sartenes y sanitización']);
            }
        }
    }

    // 5. Check & Seed Sample Employees
    const empCount = await query("SELECT COUNT(*) as count FROM employees");
    if ((empCount[0]?.count || 0) === 0) {
        const sampleEmployees = [
            {
                code: 'EMP-001',
                first_name: 'Mateo',
                last_name: 'Hernández Solís',
                rfc: 'HESM900412AB1',
                curp: 'HESM900412HDFRNT01',
                nss: '12908845671',
                email: 'mateo.hernandez@tropico56.com',
                phone: '55 4123 9876',
                address: 'Av. Costera 56, Col. Centro',
                birth_date: '1990-04-12',
                hire_date: '2023-03-01',
                dept_name: 'Cocina',
                pos_name: 'Chef Ejecutivo',
                daily_salary: 850.00,
                shift: 'Matutino',
                status: 'active'
            },
            {
                code: 'EMP-002',
                first_name: 'Valeria',
                last_name: 'Castillo Vega',
                rfc: 'CAVV950820CD2',
                curp: 'CAVV950820MDFRNT02',
                nss: '23958812345',
                email: 'valeria.castillo@tropico56.com',
                phone: '55 8765 4321',
                address: 'Calle Palmas 102, Col. Marina',
                birth_date: '1995-08-20',
                hire_date: '2024-05-15',
                dept_name: 'Barra y Coctelería',
                pos_name: 'Bartender / Mixólogo',
                daily_salary: 450.00,
                shift: 'Vespertino',
                status: 'active'
            },
            {
                code: 'EMP-003',
                first_name: 'Carlos',
                last_name: 'Ramírez Navarro',
                rfc: 'RANC921105EF3',
                curp: 'RANC921105HDFRNT03',
                nss: '34928898765',
                email: 'carlos.ramirez@tropico56.com',
                phone: '55 3344 5566',
                address: 'Paseo del Sol 45, Fracc. Brisas',
                birth_date: '1992-11-05',
                hire_date: '2025-02-10',
                dept_name: 'Servicio y Salón',
                pos_name: 'Capitán de Meseros',
                daily_salary: 520.00,
                shift: 'Mixto',
                status: 'active'
            },
            {
                code: 'EMP-004',
                first_name: 'Sofia',
                last_name: 'Mendoza Ruiz',
                rfc: 'MERS980315GH4',
                curp: 'MERS980315MDFRNT04',
                nss: '45988865432',
                email: 'sofia.mendoza@tropico56.com',
                phone: '55 6677 8899',
                address: 'Calle Flamingos 12, Col. Playa',
                birth_date: '1998-03-15',
                hire_date: '2025-06-01',
                dept_name: 'Servicio y Salón',
                pos_name: 'Mesero / Host',
                daily_salary: 340.00,
                shift: 'Vespertino',
                status: 'active'
            },
            {
                code: 'EMP-005',
                first_name: 'Diego',
                last_name: 'Gómez Alarcón',
                rfc: 'GOAD940910IJ5',
                curp: 'GOAD940910HDFRNT05',
                nss: '56948832109',
                email: 'diego.gomez@tropico56.com',
                phone: '55 1122 3344',
                address: 'Av. Principal 89, Col. Jardines',
                birth_date: '1994-09-10',
                hire_date: '2024-11-01',
                dept_name: 'Cocina',
                pos_name: 'Cocinero A',
                daily_salary: 480.00,
                shift: 'Matutino',
                status: 'active'
            },
            {
                code: 'EMP-006',
                first_name: 'Lucía',
                last_name: 'Pérez Torres',
                rfc: 'PETL961201KL6',
                curp: 'PETL961201MDFRNT06',
                nss: '67968845612',
                email: 'lucia.perez@tropico56.com',
                phone: '55 9988 7766',
                address: 'Calle del Mar 34, Col. Arboledas',
                birth_date: '1996-12-01',
                hire_date: '2026-01-15',
                dept_name: 'Administración',
                pos_name: 'Cajero General',
                daily_salary: 380.00,
                shift: 'Matutino',
                status: 'active'
            }
        ];

        for (const emp of sampleEmployees) {
            const deptRes = await query("SELECT id FROM departments WHERE name = ?", [emp.dept_name]);
            const posRes = await query("SELECT id FROM positions WHERE name = ?", [emp.pos_name]);

            const deptId = deptRes[0]?.id || 1;
            const posId = posRes[0]?.id || 1;

            await query(
                `INSERT INTO employees (
                    code, first_name, last_name, rfc, curp, nss, email, phone, address, 
                    birth_date, hire_date, department_id, position_id, contract_type, 
                    daily_salary, shift, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    emp.code, emp.first_name, emp.last_name, emp.rfc, emp.curp, emp.nss,
                    emp.email, emp.phone, emp.address, emp.birth_date, emp.hire_date,
                    deptId, posId, 'Indeterminado', emp.daily_salary, emp.shift, emp.status
                ]
            );
        }

        // Seed sample vacation request, incident, and attendance
        await query(
            "INSERT INTO vacation_requests (employee_id, start_date, end_date, days_requested, vacation_pay_percentage, status, notes) VALUES (1, '2026-04-10', '2026-04-15', 6, 25.00, 'approved', 'Periodo de primavera aprobado')"
        );

        await query(
            "INSERT INTO incidents (employee_id, date, type, description, total_amount, installments, installment_amount, pending_amount, status) VALUES (4, '2026-08-05', 'Cristalería / Loza Rota', 'Rotura involuntaria de bandeja con 6 copas de cóctel insignia', 450.00, 2, 225.00, 225.00, 'in_payroll')"
        );
    }
}

module.exports = {
    query,
    initDatabase,
    getDriver: () => 'mysql',
    getPool: () => pool
};
