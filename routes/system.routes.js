const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB max
const { query, initDatabase, getDriver } = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/system/status - Database and system status
router.get('/status', verifyToken, async (req, res) => {
    try {
        const driver = getDriver();
        const settings = await query('SELECT * FROM system_settings');
        const counts = {
            users: (await query('SELECT COUNT(*) as count FROM users'))[0]?.count || 0,
            departments: (await query('SELECT COUNT(*) as count FROM departments'))[0]?.count || 0,
            positions: (await query('SELECT COUNT(*) as count FROM positions'))[0]?.count || 0,
            employees: (await query('SELECT COUNT(*) as count FROM employees'))[0]?.count || 0,
            attendance: (await query('SELECT COUNT(*) as count FROM attendance'))[0]?.count || 0,
            vacations: (await query('SELECT COUNT(*) as count FROM vacation_requests'))[0]?.count || 0,
            incidents: (await query('SELECT COUNT(*) as count FROM incidents'))[0]?.count || 0,
            payrolls: (await query('SELECT COUNT(*) as count FROM payrolls'))[0]?.count || 0
        };

        res.json({
            success: true,
            status: {
                driver,
                database_name: process.env.DB_NAME || 'tropico56_sgrh',
                host: process.env.DB_HOST || 'localhost',
                counts,
                settings
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar estado del sistema.' });
    }
});

// GET /api/system/settings - get all settings
router.get('/settings', verifyToken, async (req, res) => {
    try {
        const rows = await query('SELECT * FROM system_settings');
        const settingsObj = {};
        rows.forEach(r => {
            settingsObj[r.key_name] = r.value_text;
        });
        res.json({ success: true, settings: settingsObj });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al consultar configuración.' });
    }
});

// PUT /api/system/settings - update settings
router.put('/settings', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, message: 'Configuración no válida.' });
        }

        for (const [key, val] of Object.entries(settings)) {
            const exists = await query('SELECT key_name FROM system_settings WHERE key_name = ?', [key]);
            if (exists.length > 0) {
                await query('UPDATE system_settings SET value_text = ? WHERE key_name = ?', [String(val), key]);
            } else {
                await query('INSERT INTO system_settings (key_name, value_text) VALUES (?, ?)', [key, String(val)]);
            }
        }

        res.json({ success: true, message: 'Configuración del sistema guardada con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar configuración.' });
    }
});

// GET /api/system/backup - EXPORT / DOWNLOAD DATABASE BACKUP
router.get('/backup', verifyToken, requireAdmin, async (req, res) => {
    try {
        const format = req.query.format || 'json'; // 'json' or 'sql'

        const tables = [
            'system_settings', 'users', 'departments', 'positions',
            'employees', 'attendance', 'lft_vacation_rules',
            'vacation_requests', 'incidents', 'payrolls', 'payroll_details'
        ];

        const backupData = {
            app: 'Trópico 56 SGRH',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            tables: {}
        };

        for (const table of tables) {
            try {
                const rows = await query(`SELECT * FROM ${table}`);
                backupData.tables[table] = rows;
            } catch (err) {
                backupData.tables[table] = [];
            }
        }

        if (format === 'sql') {
            let sqlOutput = `-- ==========================================================\n`;
            sqlOutput += `-- RESPALDO DE BASE DE DATOS SGRH - TRÓPICO 56\n`;
            sqlOutput += `-- FECHA: ${new Date().toISOString()}\n`;
            sqlOutput += `-- ==========================================================\n\n`;

            for (const [table, rows] of Object.entries(backupData.tables)) {
                if (rows.length > 0) {
                    sqlOutput += `-- Datos para la tabla: ${table}\n`;
                    for (const row of rows) {
                        const cols = Object.keys(row).map(c => `\`${c}\``).join(', ');
                        const vals = Object.values(row).map(v => {
                            if (v === null) return 'NULL';
                            if (typeof v === 'number') return v;
                            return `'${String(v).replace(/'/g, "''")}'`;
                        }).join(', ');
                        sqlOutput += `INSERT INTO \`${table}\` (${cols}) VALUES (${vals});\n`;
                    }
                    sqlOutput += `\n`;
                }
            }

            res.setHeader('Content-Type', 'application/sql');
            res.setHeader('Content-Disposition', `attachment; filename=backup_tropico56_${Date.now()}.sql`);
            return res.send(sqlOutput);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_tropico56_${Date.now()}.json`);
        res.json(backupData);
    } catch (error) {
        console.error('Error al generar respaldo:', error);
        res.status(500).json({ success: false, message: 'Error al generar respaldo de la base de datos.' });
    }
});

// POST /api/system/restore - UPLOAD & RESTORE DATABASE BACKUP
router.post('/restore', verifyToken, requireAdmin, upload.single('backup_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Debe seleccionar un archivo de respaldo (JSON o SQL).' });
        }

        const fileContent = req.file.buffer.toString('utf-8');
        const isJson = req.file.originalname.endsWith('.json') || fileContent.trim().startsWith('{');

        if (isJson) {
            const data = JSON.parse(fileContent);
            if (!data.tables || typeof data.tables !== 'object') {
                return res.status(400).json({ success: false, message: 'Estructura de archivo de respaldo JSON inválida.' });
            }

            const tablesOrder = [
                'payroll_details', 'payrolls', 'incidents', 'vacation_requests',
                'attendance', 'employees', 'positions', 'departments',
                'lft_vacation_rules', 'users', 'system_settings'
            ];

            // Clean existing data in reverse foreign key order
            await query('SET FOREIGN_KEY_CHECKS = 0');
            for (const table of tablesOrder) {
                try {
                    await query(`DELETE FROM ${table}`);
                } catch (e) {
                    console.warn(`Aviso al limpiar ${table}:`, e.message);
                }
            }

            // Restore tables in logical dependency order
            const restoreOrder = [
                'system_settings', 'users', 'departments', 'positions',
                'lft_vacation_rules', 'employees', 'attendance',
                'vacation_requests', 'incidents', 'payrolls', 'payroll_details'
            ];

            for (const table of restoreOrder) {
                const rows = data.tables[table];
                if (Array.isArray(rows) && rows.length > 0) {
                    for (const row of rows) {
                        const cols = Object.keys(row);
                        const placeholders = cols.map(() => '?').join(', ');
                        const values = Object.values(row);
                        const insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
                        await query(insertSql, values);
                    }
                }
            }
            await query('SET FOREIGN_KEY_CHECKS = 1');

            return res.json({
                success: true,
                message: 'Base de datos restaurada exitosamente desde el archivo JSON.'
            });
        } else {
            // Raw SQL statement restore
            const statements = fileContent
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--'));

            await query('SET FOREIGN_KEY_CHECKS = 0');
            for (const stmt of statements) {
                try {
                    await query(stmt);
                } catch (err) {
                    console.warn('Error al ejecutar sentencia SQL de respaldo:', err.message);
                }
            }
            await query('SET FOREIGN_KEY_CHECKS = 1');

            return res.json({
                success: true,
                message: 'Sentencias de respaldo SQL ejecutadas exitosamente.'
            });
        }
    } catch (error) {
        console.error('Error al restaurar base de datos:', error);
        res.status(500).json({ success: false, message: `Error al restaurar base de datos: ${error.message}` });
    }
});

// POST /api/system/reset - WIPE DATABASE & REINITIALIZE FRESH
router.post('/reset', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { confirmation } = req.body;
        if (confirmation !== 'BORRAR_TODO_TROPICO_56') {
            return res.status(400).json({
                success: false,
                message: 'Confirmación de seguridad no válida. Debes escribir "BORRAR_TODO_TROPICO_56".'
            });
        }

        const tables = [
            'payroll_details', 'payrolls', 'incidents', 'vacation_requests',
            'attendance', 'employees', 'positions', 'departments',
            'lft_vacation_rules', 'users', 'system_settings'
        ];

        await query('SET FOREIGN_KEY_CHECKS = 0');
        for (const table of tables) {
            try {
                await query(`DROP TABLE IF EXISTS ${table}`);
            } catch (e) {
                console.warn(`Aviso al borrar tabla ${table}:`, e.message);
            }
        }
        await query('SET FOREIGN_KEY_CHECKS = 1');

        // Reinitialize tables and seed data
        await initDatabase();

        res.json({
            success: true,
            message: 'La base de datos ha sido borrada y reinicializada exitosamente con la estructura limpia y datos base de Trópico 56.'
        });
    } catch (error) {
        console.error('Error al reiniciar base de datos:', error);
        res.status(500).json({ success: false, message: 'Error al reiniciar la base de datos.' });
    }
});

module.exports = router;
