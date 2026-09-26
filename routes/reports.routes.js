const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// Helper to escape CSV cell value
function escapeCSV(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

// GET /api/reports/stats - Global summary KPIs for the reports dashboard
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        // 1. Employees stats
        const empStats = await query(`
            SELECT 
                COUNT(*) as total_employees,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_employees,
                COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_employees,
                COALESCE(SUM(CASE WHEN status = 'active' THEN daily_salary * 30 ELSE 0 END), 0) as estimated_monthly_payroll
            FROM employees
        `);

        // 2. Attendance stats (filtered by date if provided)
        let attSql = `
            SELECT 
                COUNT(*) as total_logs,
                COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count,
                COUNT(CASE WHEN status LIKE '%absence%' THEN 1 END) as absence_count,
                COALESCE(SUM(overtime_hours), 0) as total_overtime_hours,
                COUNT(CASE WHEN is_holiday_worked = 1 THEN 1 END) as holidays_worked
            FROM attendance WHERE 1=1
        `;
        const attParams = [];
        if (start_date) { attSql += ' AND date >= ?'; attParams.push(start_date); }
        if (end_date) { attSql += ' AND date <= ?'; attParams.push(end_date); }
        const attStats = await query(attSql, attParams);

        // 3. Incidents stats (filtered by date if provided)
        let incSql = `
            SELECT 
                COUNT(*) as total_incidents,
                COALESCE(SUM(total_amount), 0) as total_charged,
                COALESCE(SUM(pending_amount), 0) as total_pending,
                COALESCE(SUM(total_amount - pending_amount), 0) as total_recovered
            FROM incidents WHERE 1=1
        `;
        const incParams = [];
        if (start_date) { incSql += ' AND date >= ?'; incParams.push(start_date); }
        if (end_date) { incSql += ' AND date <= ?'; incParams.push(end_date); }
        const incStats = await query(incSql, incParams);

        // 4. Payroll stats (filtered by date if provided)
        let paySql = `
            SELECT 
                COUNT(*) as total_payrolls,
                COALESCE(SUM(total_perceptions), 0) as total_perceptions,
                COALESCE(SUM(total_deductions), 0) as total_deductions,
                COALESCE(SUM(net_total), 0) as net_total
            FROM payrolls WHERE 1=1
        `;
        const payParams = [];
        if (start_date) { paySql += ' AND start_date >= ?'; payParams.push(start_date); }
        if (end_date) { paySql += ' AND end_date <= ?'; payParams.push(end_date); }
        const payStats = await query(paySql, payParams);

        res.json({
            success: true,
            stats: {
                employees: empStats[0] || {},
                attendance: attStats[0] || {},
                incidents: incStats[0] || {},
                payroll: payStats[0] || {}
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas de reportes:', error);
        res.status(500).json({ success: false, message: 'Error al consultar resumen de reportes.' });
    }
});

// GET /api/reports/preview - Paginated data for Infinity Scroll preview table
router.get('/preview', verifyToken, async (req, res) => {
    try {
        const type = req.query.type || 'employees';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const offset = (page - 1) * limit;
        const { start_date, end_date, status, department_id } = req.query;

        let list = [];
        let total = 0;

        if (type === 'employees') {
            let countSql = 'SELECT COUNT(*) as total FROM employees e WHERE 1=1';
            let dataSql = `
                SELECT 
                    e.id, e.code, e.first_name, e.last_name, e.rfc, e.curp, e.nss,
                    e.daily_salary, e.shift, e.contract_type, e.hire_date, e.status,
                    CASE 
                        WHEN e.status = 'inactive' THEN DATE(e.updated_at)
                        ELSE NULL 
                    END as inactive_date,
                    d.name as department_name,
                    p.name as position_name
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            const countParams = [];

            if (status) {
                countSql += ' AND e.status = ?';
                dataSql += ' AND e.status = ?';
                params.push(status);
                countParams.push(status);
            }
            if (department_id) {
                countSql += ' AND e.department_id = ?';
                dataSql += ' AND e.department_id = ?';
                params.push(parseInt(department_id));
                countParams.push(parseInt(department_id));
            }

            dataSql += ' ORDER BY e.id ASC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const countRes = await query(countSql, countParams);
            total = countRes[0]?.total || 0;
            list = await query(dataSql, params);
        } else if (type === 'attendance') {
            let countSql = 'SELECT COUNT(*) as total FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE 1=1';
            let dataSql = `
                SELECT 
                    a.id, a.date, a.check_in, a.check_out, a.status, a.overtime_hours, a.is_holiday_worked, a.notes,
                    e.code, e.first_name, e.last_name,
                    d.name as department_name,
                    p.name as position_name
                FROM attendance a
                JOIN employees e ON e.id = a.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            const countParams = [];

            if (start_date) {
                countSql += ' AND a.date >= ?';
                dataSql += ' AND a.date >= ?';
                params.push(start_date);
                countParams.push(start_date);
            }
            if (end_date) {
                countSql += ' AND a.date <= ?';
                dataSql += ' AND a.date <= ?';
                params.push(end_date);
                countParams.push(end_date);
            }
            if (status) {
                countSql += ' AND a.status = ?';
                dataSql += ' AND a.status = ?';
                params.push(status);
                countParams.push(status);
            }

            dataSql += ' ORDER BY a.date DESC, a.id DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const countRes = await query(countSql, countParams);
            total = countRes[0]?.total || 0;
            list = await query(dataSql, params);
        } else if (type === 'incidents') {
            let countSql = 'SELECT COUNT(*) as total FROM incidents i JOIN employees e ON e.id = i.employee_id WHERE 1=1';
            let dataSql = `
                SELECT 
                    i.id, i.date, i.type, i.description, i.total_amount, i.installments,
                    i.installment_amount, i.pending_amount, i.status,
                    e.code, e.first_name, e.last_name,
                    d.name as department_name,
                    p.name as position_name
                FROM incidents i
                JOIN employees e ON e.id = i.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            const countParams = [];

            if (start_date) {
                countSql += ' AND i.date >= ?';
                dataSql += ' AND i.date >= ?';
                params.push(start_date);
                countParams.push(start_date);
            }
            if (end_date) {
                countSql += ' AND i.date <= ?';
                dataSql += ' AND i.date <= ?';
                params.push(end_date);
                countParams.push(end_date);
            }
            if (status) {
                countSql += ' AND i.status = ?';
                dataSql += ' AND i.status = ?';
                params.push(status);
                countParams.push(status);
            }

            dataSql += ' ORDER BY i.date DESC, i.id DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const countRes = await query(countSql, countParams);
            total = countRes[0]?.total || 0;
            list = await query(dataSql, params);
        } else if (type === 'payroll') {
            let countSql = 'SELECT COUNT(*) as total FROM payrolls p WHERE 1=1';
            let dataSql = `
                SELECT 
                    p.id, p.period_name, p.period_type, p.start_date, p.end_date,
                    p.status, p.total_perceptions, p.total_deductions, p.net_total, p.closed_at,
                    (SELECT COUNT(*) FROM payroll_details pd WHERE pd.payroll_id = p.id) as employees_count
                FROM payrolls p
                WHERE 1=1
            `;
            const params = [];
            const countParams = [];

            if (start_date) {
                countSql += ' AND p.start_date >= ?';
                dataSql += ' AND p.start_date >= ?';
                params.push(start_date);
                countParams.push(start_date);
            }
            if (end_date) {
                countSql += ' AND p.end_date <= ?';
                dataSql += ' AND p.end_date <= ?';
                params.push(end_date);
                countParams.push(end_date);
            }

            dataSql += ' ORDER BY p.start_date DESC, p.id DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const countRes = await query(countSql, countParams);
            total = countRes[0]?.total || 0;
            list = await query(dataSql, params);
        } else if (type === 'payroll_details') {
            let countSql = `
                SELECT COUNT(*) as total 
                FROM payroll_details pd 
                JOIN payrolls p ON p.id = pd.payroll_id 
                JOIN employees e ON e.id = pd.employee_id 
                WHERE 1=1
            `;
            let dataSql = `
                SELECT 
                    pd.*,
                    p.period_name, p.period_type, p.start_date as period_start_date, p.end_date as period_end_date,
                    e.code as employee_code, e.first_name, e.last_name, e.rfc, e.curp, e.nss, e.daily_salary as emp_daily_salary,
                    d.name as department_name,
                    pos.name as position_name
                FROM payroll_details pd
                JOIN payrolls p ON p.id = pd.payroll_id
                JOIN employees e ON e.id = pd.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions pos ON pos.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            const countParams = [];

            if (start_date) {
                countSql += ' AND p.start_date >= ?';
                dataSql += ' AND p.start_date >= ?';
                params.push(start_date);
                countParams.push(start_date);
            }
            if (end_date) {
                countSql += ' AND p.end_date <= ?';
                dataSql += ' AND p.end_date <= ?';
                params.push(end_date);
                countParams.push(end_date);
            }

            dataSql += ' ORDER BY p.start_date DESC, d.name ASC, e.first_name ASC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const countRes = await query(countSql, countParams);
            total = countRes[0]?.total || 0;
            list = await query(dataSql, params);
        }

        res.json({
            success: true,
            type,
            data: list,
            pagination: {
                page,
                limit,
                total,
                hasMore: offset + list.length < total
            }
        });
    } catch (error) {
        console.error('Error al generar vista previa de reporte:', error);
        res.status(500).json({ success: false, message: 'Error al consultar datos de reporte.' });
    }
});

// GET /api/reports/download - Full CSV download with UTF-8 BOM
router.get('/download', verifyToken, async (req, res) => {
    try {
        const type = req.query.type || 'employees';
        const { start_date, end_date, status, department_id } = req.query;

        let csvRows = [];
        let filename = `reporte_${type}_${new Date().toISOString().split('T')[0]}.csv`;

        if (type === 'employees') {
            filename = `reporte_empleados_tropico56_${new Date().toISOString().split('T')[0]}.csv`;
            csvRows.push([
                'Código', 'Nombre Completo', 'Puesto', 'Departamento', 'RFC', 'CURP', 'NSS',
                'Salario Diario (MXN)', 'Turno', 'Tipo Contrato', 'Fecha Ingreso', 'Estatus', 'Fecha de Baja / Inactivo'
            ].map(escapeCSV).join(','));

            let sql = `
                SELECT 
                    e.code, e.first_name, e.last_name, e.rfc, e.curp, e.nss,
                    e.daily_salary, e.shift, e.contract_type, e.hire_date, e.status,
                    CASE 
                        WHEN e.status = 'inactive' THEN DATE(e.updated_at)
                        ELSE NULL 
                    END as inactive_date,
                    d.name as department_name,
                    p.name as position_name
                FROM employees e
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            if (status) { sql += ' AND e.status = ?'; params.push(status); }
            if (department_id) { sql += ' AND e.department_id = ?'; params.push(parseInt(department_id)); }
            sql += ' ORDER BY e.id ASC';

            const rows = await query(sql, params);
            rows.forEach(r => {
                const statusLabel = r.status === 'active' ? 'Activo' : (r.status === 'inactive' ? 'Inactivo (Baja)' : (r.status === 'vacation' ? 'Vacaciones' : 'Permiso'));
                const inactiveDateStr = r.status === 'inactive' ? (r.inactive_date || 'Fecha no registrada') : 'N/A (Activo)';

                csvRows.push([
                    r.code,
                    `${r.first_name} ${r.last_name}`,
                    r.position_name || 'Sin Asignar',
                    r.department_name || 'General',
                    r.rfc || '',
                    r.curp || '',
                    r.nss || '',
                    parseFloat(r.daily_salary || 0).toFixed(2),
                    r.shift || 'Matutino',
                    r.contract_type || 'Indeterminado',
                    r.hire_date,
                    statusLabel,
                    inactiveDateStr
                ].map(escapeCSV).join(','));
            });
        } else if (type === 'attendance') {
            filename = `reporte_asistencias_tropico56_${start_date || 'inicio'}_al_${end_date || 'fin'}.csv`;
            csvRows.push([
                'Fecha', 'Código Empleado', 'Nombre Completo', 'Departamento', 'Puesto',
                'Hora Entrada', 'Hora Salida', 'Horas Extra', 'Festivo Laborado', 'Estatus', 'Notas'
            ].map(escapeCSV).join(','));

            let sql = `
                SELECT 
                    a.date, a.check_in, a.check_out, a.status, a.overtime_hours, a.is_holiday_worked, a.notes,
                    e.code, e.first_name, e.last_name,
                    d.name as department_name,
                    p.name as position_name
                FROM attendance a
                JOIN employees e ON e.id = a.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            if (start_date) { sql += ' AND a.date >= ?'; params.push(start_date); }
            if (end_date) { sql += ' AND a.date <= ?'; params.push(end_date); }
            if (status) { sql += ' AND a.status = ?'; params.push(status); }
            sql += ' ORDER BY a.date DESC, e.first_name ASC';

            const rows = await query(sql, params);
            rows.forEach(r => {
                let statusDesc = 'Presente';
                if (r.status === 'late') statusDesc = 'Retardo';
                else if (r.status === 'early_departure') statusDesc = 'Salida Anticipada';
                else if (r.status === 'vacation') statusDesc = 'Vacaciones';
                else if (r.status === 'leave') statusDesc = 'Permiso / Incapacidad';
                else if (r.status === 'justified_absence') statusDesc = 'Falta Justificada';
                else if (r.status === 'unjustified_absence') statusDesc = 'Falta Injustificada';

                csvRows.push([
                    r.date,
                    r.code,
                    `${r.first_name} ${r.last_name}`,
                    r.department_name || 'General',
                    r.position_name || 'Sin Asignar',
                    r.check_in ? r.check_in.substring(0, 5) : '--:--',
                    r.check_out ? r.check_out.substring(0, 5) : '--:--',
                    parseFloat(r.overtime_hours || 0).toFixed(1),
                    r.is_holiday_worked ? 'SÍ (Doble)' : 'NO',
                    statusDesc,
                    r.notes || ''
                ].map(escapeCSV).join(','));
            });
        } else if (type === 'incidents') {
            filename = `reporte_incidencias_tropico56_${start_date || 'inicio'}_al_${end_date || 'fin'}.csv`;
            csvRows.push([
                'Fecha', 'Código Empleado', 'Colaborador Responsable', 'Departamento', 'Puesto',
                'Tipo de Incidencia', 'Descripción del Incidente', 'Monto Total (MXN)',
                'Cuotas Pactadas', 'Monto por Cuota (MXN)', 'Saldo Pendiente (MXN)', 'Estatus'
            ].map(escapeCSV).join(','));

            let sql = `
                SELECT 
                    i.date, i.type, i.description, i.total_amount, i.installments,
                    i.installment_amount, i.pending_amount, i.status,
                    e.code, e.first_name, e.last_name,
                    d.name as department_name,
                    p.name as position_name
                FROM incidents i
                JOIN employees e ON e.id = i.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions p ON p.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            if (start_date) { sql += ' AND i.date >= ?'; params.push(start_date); }
            if (end_date) { sql += ' AND i.date <= ?'; params.push(end_date); }
            if (status) { sql += ' AND i.status = ?'; params.push(status); }
            sql += ' ORDER BY i.date DESC';

            const rows = await query(sql, params);
            rows.forEach(r => {
                let stDesc = 'Pendiente';
                if (r.status === 'in_payroll') stDesc = 'En Nómina';
                else if (r.status === 'paid') stDesc = 'Liquidado / Pagado';
                else if (r.status === 'cancelled') stDesc = 'Cancelado / Condonado';

                csvRows.push([
                    r.date,
                    r.code,
                    `${r.first_name} ${r.last_name}`,
                    r.department_name || 'General',
                    r.position_name || 'Sin Asignar',
                    r.type,
                    r.description,
                    parseFloat(r.total_amount || 0).toFixed(2),
                    r.installments,
                    parseFloat(r.installment_amount || 0).toFixed(2),
                    parseFloat(r.pending_amount || 0).toFixed(2),
                    stDesc
                ].map(escapeCSV).join(','));
            });
        } else if (type === 'payroll') {
            filename = `reporte_nominas_tropico56_${start_date || 'inicio'}_al_${end_date || 'fin'}.csv`;
            csvRows.push([
                'Periodo / Identificador', 'Tipo de Periodo', 'Fecha Inicio', 'Fecha Fin',
                'Colaboradores Pagados', 'Total Percepciones (MXN)', 'Total Deducciones (MXN)',
                'Gran Total Neto Dispersado (MXN)', 'Estatus', 'Fecha de Cierre'
            ].map(escapeCSV).join(','));

            let sql = `
                SELECT 
                    p.period_name, p.period_type, p.start_date, p.end_date,
                    p.status, p.total_perceptions, p.total_deductions, p.net_total, p.closed_at,
                    (SELECT COUNT(*) FROM payroll_details pd WHERE pd.payroll_id = p.id) as employees_count
                FROM payrolls p
                WHERE 1=1
            `;
            const params = [];
            if (start_date) { sql += ' AND p.start_date >= ?'; params.push(start_date); }
            if (end_date) { sql += ' AND p.end_date <= ?'; params.push(end_date); }
            sql += ' ORDER BY p.start_date DESC';

            const rows = await query(sql, params);
            rows.forEach(r => {
                csvRows.push([
                    r.period_name,
                    r.period_type ? r.period_type.toUpperCase() : 'QUINCENAL',
                    r.start_date,
                    r.end_date,
                    r.employees_count || 0,
                    parseFloat(r.total_perceptions || 0).toFixed(2),
                    parseFloat(r.total_deductions || 0).toFixed(2),
                    parseFloat(r.net_total || 0).toFixed(2),
                    r.status === 'closed' ? 'Cerrada / Pagada' : 'Borrador',
                    r.closed_at || 'En proceso'
                ].map(escapeCSV).join(','));
            });
        } else if (type === 'payroll_details') {
            filename = `reporte_desglose_nominas_por_trabajador_${start_date || 'inicio'}_al_${end_date || 'fin'}.csv`;
            csvRows.push([
                'Periodo Nómina', 'Fecha Inicio', 'Fecha Fin',
                'Código Empleado', 'Nombre Colaborador', 'Puesto', 'Departamento', 'RFC', 'CURP', 'NSS',
                'Salario Diario (MXN)', 'Días Trabajados', 'Sueldo Base (MXN)',
                'Horas Extras (MXN)', 'Días Festivos (MXN)', 'Bonos (MXN)', 'Comisiones (MXN)',
                'Prima Vacacional (MXN)', 'Aguinaldo (MXN)', 'Total Percepciones (MXN)',
                'Incidencias / Mermas (MXN)', 'Retención IMSS (MXN)', 'Retención ISR (MXN)',
                'Otras Deducciones (MXN)', 'Total Deducciones (MXN)',
                'Neto a Pagar (MXN)'
            ].map(escapeCSV).join(','));

            let sql = `
                SELECT 
                    pd.*,
                    p.period_name, p.start_date as period_start_date, p.end_date as period_end_date,
                    e.code as employee_code, e.first_name, e.last_name, e.rfc, e.curp, e.nss, e.daily_salary as emp_daily_salary,
                    d.name as department_name,
                    pos.name as position_name
                FROM payroll_details pd
                JOIN payrolls p ON p.id = pd.payroll_id
                JOIN employees e ON e.id = pd.employee_id
                LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN positions pos ON pos.id = e.position_id
                WHERE 1=1
            `;
            const params = [];
            if (start_date) { sql += ' AND p.start_date >= ?'; params.push(start_date); }
            if (end_date) { sql += ' AND p.end_date <= ?'; params.push(end_date); }
            sql += ' ORDER BY p.start_date DESC, d.name ASC, e.first_name ASC';

            const rows = await query(sql, params);
            rows.forEach(r => {
                csvRows.push([
                    r.period_name,
                    r.period_start_date,
                    r.period_end_date,
                    r.employee_code,
                    `${r.first_name} ${r.last_name}`,
                    r.position_name || 'Sin Puesto',
                    r.department_name || 'General',
                    r.rfc || 'N/A',
                    r.curp || 'N/A',
                    r.nss || 'N/A',
                    parseFloat(r.emp_daily_salary || r.daily_salary || 0).toFixed(2),
                    parseFloat(r.days_worked || 0).toFixed(1),
                    parseFloat(r.base_salary || 0).toFixed(2),
                    parseFloat(r.overtime_pay || r.overtime_amount || 0).toFixed(2),
                    parseFloat(r.holiday_pay || r.holiday_amount || 0).toFixed(2),
                    parseFloat(r.bonus || r.bonus_amount || 0).toFixed(2),
                    parseFloat(r.commissions || 0).toFixed(2),
                    parseFloat(r.vacation_bonus || r.vacation_amount || 0).toFixed(2),
                    parseFloat(r.christmas_bonus || 0).toFixed(2),
                    parseFloat(r.total_perceptions || 0).toFixed(2),
                    parseFloat(r.incident_deductions || 0).toFixed(2),
                    parseFloat(r.social_security_deductions || r.imss_deduction || 0).toFixed(2),
                    parseFloat(r.tax_deductions || r.isr_deduction || 0).toFixed(2),
                    parseFloat(r.other_deductions || 0).toFixed(2),
                    parseFloat(r.total_deductions || 0).toFixed(2),
                    parseFloat(r.net_pay || r.net_salary || 0).toFixed(2)
                ].map(escapeCSV).join(','));
            });
        }

        // Add UTF-8 BOM (\uFEFF) for perfect native Excel rendering
        const csvContent = '\uFEFF' + csvRows.join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csvContent);
    } catch (error) {
        console.error('Error al descargar reporte CSV:', error);
        res.status(500).json({ success: false, message: 'Error al generar el archivo CSV.' });
    }
});

module.exports = router;
