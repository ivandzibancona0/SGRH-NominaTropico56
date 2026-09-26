// ==========================================================
// SISTEMA DE GESTIÓN DE RECURSOS HUMANOS - TRÓPICO 56
// Módulo de Reportes y Exportación CSV con Infinity Scroll
// ==========================================================

const ReportsModule = {
    currentType: 'employees',
    currentStartDate: '',
    currentEndDate: '',
    currentStatus: '',
    infinityTable: null,

    async render(container) {
        const main = container || document.getElementById('app-main-content');

        // Initial dates: Current month
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

        this.currentStartDate = `${year}-${month}-01`;
        this.currentEndDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        this.currentType = 'employees';
        this.currentStatus = '';

        main.innerHTML = `
            <div class="view-header">
                <div>
                    <h2>Centro de Reportes y Exportación CSV</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">
                        Generación, auditoría y descarga en formato CSV compatible nativamente con Microsoft Excel para todas las áreas operativas.
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btn-download-csv-top">
                        <span style="width: 18px; height: 18px;">${Icons.download}</span>
                        <span>Descargar Reporte CSV</span>
                    </button>
                </div>
            </div>

            <!-- Summary KPI Cards -->
            <div class="kpi-grid" id="reports-kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon primary">${Icons.employees}</div>
                    <div class="kpi-content">
                        <h4>Plantilla Total</h4>
                        <div class="kpi-value" id="kpi-emp-total">--</div>
                        <div class="kpi-subtext" id="kpi-emp-sub">Cargando...</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon success">${Icons.attendance}</div>
                    <div class="kpi-content">
                        <h4>Asistencias Periodo</h4>
                        <div class="kpi-value" id="kpi-att-total">--</div>
                        <div class="kpi-subtext" id="kpi-att-sub">Cargando...</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon accent">${Icons.incidents}</div>
                    <div class="kpi-content">
                        <h4>Incidencias / Mermas</h4>
                        <div class="kpi-value" id="kpi-inc-total" style="color: var(--color-danger);">--</div>
                        <div class="kpi-subtext" id="kpi-inc-sub">Cargando...</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon gold">${Icons.payroll}</div>
                    <div class="kpi-content">
                        <h4>Nóminas Dispersadas</h4>
                        <div class="kpi-value" id="kpi-pay-total" style="color: var(--color-primary);">--</div>
                        <div class="kpi-subtext" id="kpi-pay-sub">Cargando...</div>
                    </div>
                </div>
            </div>

            <!-- Filters and Controls Card -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; justify-content: space-between;">
                    <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end;">
                        <div class="form-group" style="margin-bottom: 0; min-width: 220px;">
                            <label style="font-weight: 600; font-size: 0.85rem;">Tipo de Reporte a Generar</label>
                            <select id="report-type-select" class="form-control" style="font-weight: 600;">
                                <option value="employees" selected>👥 Reporte de Colaboradores (Plantilla)</option>
                                <option value="attendance">📅 Reporte de Asistencias & Retardos</option>
                                <option value="incidents">⚠️ Reporte de Incidencias & Mermas</option>
                                <option value="payroll">💵 Reporte de Nóminas & Dispersiones (Resumen Periodos)</option>
                                <option value="payroll_details">📑 Desglose de Nómina por Trabajador (Detallado)</option>
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 0; width: 150px;">
                            <label style="font-weight: 600; font-size: 0.85rem;">Fecha Inicial</label>
                            <input type="date" id="report-start-date" class="form-control" value="${this.currentStartDate}">
                        </div>

                        <div class="form-group" style="margin-bottom: 0; width: 150px;">
                            <label style="font-weight: 600; font-size: 0.85rem;">Fecha Final</label>
                            <input type="date" id="report-end-date" class="form-control" value="${this.currentEndDate}">
                        </div>

                        <div class="form-group" style="margin-bottom: 0; width: 150px;" id="report-status-group">
                            <label style="font-weight: 600; font-size: 0.85rem;">Filtrar Estatus</label>
                            <select id="report-status-select" class="form-control">
                                <option value="">Todos los Estatus</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos (Bajas)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Date Shortcuts -->
                    <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" id="btn-quick-this-month">Este Mes</button>
                        <button class="btn btn-secondary btn-sm" id="btn-quick-last-month">Mes Anterior</button>
                        <button class="btn btn-secondary btn-sm" id="btn-quick-last-30">Últimos 30 Días</button>
                        <button class="btn btn-secondary btn-sm" id="btn-quick-this-year">Año Actual</button>
                        <button class="btn btn-secondary btn-sm" id="btn-quick-all">Todo</button>
                    </div>
                </div>
            </div>

            <!-- Preview Table Card with Infinity Scroll -->
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <h3 id="report-table-title">
                        <span style="width: 20px; height: 20px;">${Icons.table}</span>
                        Vista Previa del Reporte de Colaboradores
                    </h3>
                    <div style="font-size: 0.82rem; color: var(--color-muted);" id="report-count-indicator">
                        Cargando registros...
                    </div>
                </div>

                <div class="table-container" id="report-table-container" style="border: none; box-shadow: none;">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead id="report-table-head">
                                <!-- Dynamic Headers -->
                            </thead>
                            <tbody id="report-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.setupHandlers();
        await this.loadStats();
        this.renderTableForType();
    },

    setupHandlers() {
        // Report type change
        document.getElementById('report-type-select').addEventListener('change', (e) => {
            this.currentType = e.target.value;
            this.updateStatusFilterOptions();
            this.renderTableForType();
            this.loadStats();
        });

        // Date changes
        document.getElementById('report-start-date').addEventListener('change', (e) => {
            this.currentStartDate = e.target.value;
            this.loadStats();
            this.infinityTable?.resetAndLoad();
        });

        document.getElementById('report-end-date').addEventListener('change', (e) => {
            this.currentEndDate = e.target.value;
            this.loadStats();
            this.infinityTable?.resetAndLoad();
        });

        // Status change
        document.getElementById('report-status-select').addEventListener('change', (e) => {
            this.currentStatus = e.target.value;
            this.infinityTable?.resetAndLoad();
        });

        // Date Shortcuts
        document.getElementById('btn-quick-this-month').addEventListener('click', () => {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const lastD = new Date(y, now.getMonth() + 1, 0).getDate();
            this.setDateRange(`${y}-${m}-01`, `${y}-${m}-${String(lastD).padStart(2, '0')}`);
        });

        document.getElementById('btn-quick-last-month').addEventListener('click', () => {
            const now = new Date();
            const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const y = prev.getFullYear();
            const m = String(prev.getMonth() + 1).padStart(2, '0');
            const lastD = new Date(y, prev.getMonth() + 1, 0).getDate();
            this.setDateRange(`${y}-${m}-01`, `${y}-${m}-${String(lastD).padStart(2, '0')}`);
        });

        document.getElementById('btn-quick-last-30').addEventListener('click', () => {
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 30);
            this.setDateRange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
        });

        document.getElementById('btn-quick-this-year').addEventListener('click', () => {
            const y = new Date().getFullYear();
            this.setDateRange(`${y}-01-01`, `${y}-12-31`);
        });

        document.getElementById('btn-quick-all').addEventListener('click', () => {
            this.setDateRange('', '');
        });

        // Download CSV trigger
        document.getElementById('btn-download-csv-top').addEventListener('click', () => {
            this.downloadCSV();
        });
    },

    setDateRange(start, end) {
        this.currentStartDate = start;
        this.currentEndDate = end;
        document.getElementById('report-start-date').value = start;
        document.getElementById('report-end-date').value = end;
        this.loadStats();
        this.infinityTable?.resetAndLoad();
    },

    updateStatusFilterOptions() {
        const select = document.getElementById('report-status-select');
        const group = document.getElementById('report-status-group');
        this.currentStatus = '';

        if (this.currentType === 'employees') {
            group.style.display = 'block';
            select.innerHTML = `
                <option value="" selected>Todos los Estatus</option>
                <option value="active">Solo Activos</option>
                <option value="inactive">Solo Inactivos (Bajas)</option>
            `;
        } else if (this.currentType === 'attendance') {
            group.style.display = 'block';
            select.innerHTML = `
                <option value="" selected>Todos los Estatus</option>
                <option value="present">Presente</option>
                <option value="late">Retardo</option>
                <option value="early_departure">Salida Anticipada</option>
                <option value="vacation">Vacaciones</option>
                <option value="leave">Permiso / Incap.</option>
                <option value="unjustified_absence">Falta Injustificada</option>
            `;
        } else if (this.currentType === 'incidents') {
            group.style.display = 'block';
            select.innerHTML = `
                <option value="" selected>Todos los Estatus</option>
                <option value="pending">Pendiente</option>
                <option value="in_payroll">En Nómina</option>
                <option value="paid">Liquidado / Pagado</option>
                <option value="cancelled">Cancelado / Condonado</option>
            `;
        } else {
            // Payroll has fewer status variants
            group.style.display = 'none';
        }
    },

    async loadStats() {
        try {
            const res = await API.get('/reports/stats', {
                start_date: this.currentStartDate,
                end_date: this.currentEndDate
            });

            if (res.success && res.stats) {
                const s = res.stats;

                // Employees KPI
                document.getElementById('kpi-emp-total').textContent = s.employees.total_employees || 0;
                document.getElementById('kpi-emp-sub').textContent = `${s.employees.active_employees || 0} activos · ${s.employees.inactive_employees || 0} bajas registradas`;

                // Attendance KPI
                document.getElementById('kpi-att-total').textContent = s.attendance.total_logs || 0;
                document.getElementById('kpi-att-sub').textContent = `${s.attendance.present_count || 0} presentes · ${s.attendance.late_count || 0} retardos · ${s.attendance.total_overtime_hours || 0} hrs extra`;

                // Incidents KPI
                document.getElementById('kpi-inc-total').textContent = `$${parseFloat(s.incidents.total_charged || 0).toFixed(2)}`;
                document.getElementById('kpi-inc-sub').textContent = `${s.incidents.total_incidents || 0} cargos · $${parseFloat(s.incidents.total_pending || 0).toFixed(2)} saldo pendiente`;

                // Payroll KPI
                document.getElementById('kpi-pay-total').textContent = `$${parseFloat(s.payroll.net_total || 0).toFixed(2)}`;
                document.getElementById('kpi-pay-sub').textContent = `${s.payroll.total_payrolls || 0} nóminas · Total Bruto: $${parseFloat(s.payroll.total_perceptions || 0).toFixed(2)}`;
            }
        } catch (e) {
            console.error('Error al cargar KPIs de reportes:', e);
        }
    },

    renderTableForType() {
        const thead = document.getElementById('report-table-head');
        const tbody = document.getElementById('report-tbody');
        const container = document.getElementById('report-table-container');
        const titleEl = document.getElementById('report-table-title');

        if (!thead || !tbody || !container) return;

        // Destroy previous infinity table instance and remove old observers/sentinels
        if (this.infinityTable) {
            this.infinityTable.destroy();
            this.infinityTable = null;
        }
        container.querySelectorAll('.infinity-sentinel').forEach(el => el.remove());
        tbody.innerHTML = '';

        if (this.currentType === 'employees') {
            titleEl.innerHTML = `<span style="width: 20px; height: 20px;">${Icons.employees}</span> Vista Previa del Reporte de Colaboradores (Plantilla)`;
            thead.innerHTML = `
                <tr>
                    <th>Código</th>
                    <th>Colaborador</th>
                    <th>Puesto & Departamento</th>
                    <th>RFC / CURP / NSS</th>
                    <th>Salario Diario</th>
                    <th>Turno / Contrato</th>
                    <th>Fecha Ingreso</th>
                    <th>Estatus & Fecha Baja</th>
                </tr>
            `;

            this.infinityTable = new InfinityScrollTable({
                containerElement: container,
                tbodyElement: tbody,
                emptyMessage: 'No se encontraron colaboradores con los filtros seleccionados.',
                fetchDataFunction: async (page, limit) => {
                    const res = await API.get('/reports/preview', {
                        type: 'employees',
                        status: this.currentStatus,
                        page,
                        limit
                    });
                    this.updateCountIndicator(res);
                    return res;
                },
                renderRowFunction: (row) => {
                    const isInactive = row.status === 'inactive';
                    let badgeClass = 'badge-success';
                    let statusLabel = 'Activo';

                    if (isInactive) {
                        badgeClass = 'badge-danger';
                        statusLabel = 'Inactivo';
                    } else if (row.status === 'vacation') {
                        badgeClass = 'badge-warning';
                        statusLabel = 'Vacaciones';
                    }

                    return `
                        <td><strong>${row.code}</strong></td>
                        <td>
                            <strong>${row.first_name} ${row.last_name}</strong>
                        </td>
                        <td>
                            <div>${row.position_name || 'Sin Puesto'}</div>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${row.department_name || 'General'}</div>
                        </td>
                        <td style="font-size: 0.78rem; font-family: monospace;">
                            <div>RFC: ${row.rfc || '-'}</div>
                            <div>CURP: ${row.curp || '-'}</div>
                            <div>NSS: ${row.nss || '-'}</div>
                        </td>
                        <td><strong>$${parseFloat(row.daily_salary || 0).toFixed(2)}</strong></td>
                        <td>
                            <div>${row.shift || 'Matutino'}</div>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${row.contract_type || 'Indeterminado'}</div>
                        </td>
                        <td>${row.hire_date}</td>
                        <td>
                            <span class="badge ${badgeClass}">${statusLabel}</span>
                            ${isInactive ? `
                                <div style="font-size: 0.75rem; color: var(--color-danger); font-weight: 700; margin-top: 0.25rem;">
                                    Baja: ${row.inactive_date || 'Sin fecha'}
                                </div>
                            ` : ''}
                        </td>
                    `;
                }
            });
        } else if (this.currentType === 'attendance') {
            titleEl.innerHTML = `<span style="width: 20px; height: 20px;">${Icons.attendance}</span> Vista Previa del Reporte de Asistencias & Retardos`;
            thead.innerHTML = `
                <tr>
                    <th>Fecha</th>
                    <th>Colaborador</th>
                    <th>Puesto & Depto</th>
                    <th>Hora Entrada</th>
                    <th>Hora Salida</th>
                    <th>Horas Extra</th>
                    <th>Festivo</th>
                    <th>Estatus</th>
                    <th>Notas</th>
                </tr>
            `;

            this.infinityTable = new InfinityScrollTable({
                containerElement: container,
                tbodyElement: tbody,
                emptyMessage: 'No se encontraron asistencias en el rango de fechas seleccionado.',
                fetchDataFunction: async (page, limit) => {
                    const res = await API.get('/reports/preview', {
                        type: 'attendance',
                        start_date: this.currentStartDate,
                        end_date: this.currentEndDate,
                        status: this.currentStatus,
                        page,
                        limit
                    });
                    this.updateCountIndicator(res);
                    return res;
                },
                renderRowFunction: (row) => {
                    let badgeClass = 'badge-success';
                    let statusLabel = 'Presente';
                    if (row.status === 'late') { badgeClass = 'badge-warning'; statusLabel = 'Retardo'; }
                    if (row.status === 'early_departure') { badgeClass = 'badge-warning'; statusLabel = 'Salida Anticipada'; }
                    if (row.status === 'vacation') { badgeClass = 'badge-info'; statusLabel = 'Vacaciones'; }
                    if (row.status === 'leave') { badgeClass = 'badge-info'; statusLabel = 'Permiso'; }
                    if (row.status?.includes('absence')) { badgeClass = 'badge-danger'; statusLabel = 'Falta'; }

                    return `
                        <td><strong>${row.date}</strong></td>
                        <td>
                            <strong>${row.first_name} ${row.last_name}</strong>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${row.code}</div>
                        </td>
                        <td>
                            <div>${row.position_name || '-'}</div>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${row.department_name || '-'}</div>
                        </td>
                        <td>${row.check_in ? row.check_in.substring(0, 5) : '--:--'}</td>
                        <td>${row.check_out ? row.check_out.substring(0, 5) : '--:--'}</td>
                        <td><strong>${row.overtime_hours > 0 ? `+${parseFloat(row.overtime_hours).toFixed(1)} hrs` : '0'}</strong></td>
                        <td>${row.is_holiday_worked ? '<span class="badge badge-warning">Doble</span>' : '-'}</td>
                        <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                        <td style="font-size: 0.8rem; color: var(--color-muted);">${row.notes || '-'}</td>
                    `;
                }
            });
        } else if (this.currentType === 'incidents') {
            titleEl.innerHTML = `<span style="width: 20px; height: 20px;">${Icons.incidents}</span> Vista Previa del Reporte de Incidencias & Mermas`;
            thead.innerHTML = `
                <tr>
                    <th>Fecha</th>
                    <th>Colaborador</th>
                    <th>Tipo de Incidencia</th>
                    <th>Descripción</th>
                    <th>Monto Total</th>
                    <th>Cuotas</th>
                    <th>Saldo Pendiente</th>
                    <th>Estatus</th>
                </tr>
            `;

            this.infinityTable = new InfinityScrollTable({
                containerElement: container,
                tbodyElement: tbody,
                emptyMessage: 'No se encontraron incidencias en el rango de fechas seleccionado.',
                fetchDataFunction: async (page, limit) => {
                    const res = await API.get('/reports/preview', {
                        type: 'incidents',
                        start_date: this.currentStartDate,
                        end_date: this.currentEndDate,
                        status: this.currentStatus,
                        page,
                        limit
                    });
                    this.updateCountIndicator(res);
                    return res;
                },
                renderRowFunction: (row) => {
                    let badgeClass = 'badge-danger';
                    let statusLabel = 'Pendiente';
                    if (row.status === 'in_payroll') { badgeClass = 'badge-warning'; statusLabel = 'En Nómina'; }
                    if (row.status === 'paid') { badgeClass = 'badge-success'; statusLabel = 'Liquidado'; }
                    if (row.status === 'cancelled') { badgeClass = 'badge-info'; statusLabel = 'Cancelado'; }

                    return `
                        <td><strong>${row.date}</strong></td>
                        <td>
                            <strong>${row.first_name} ${row.last_name}</strong>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${row.code} · ${row.position_name}</div>
                        </td>
                        <td><span class="badge badge-primary">${row.type}</span></td>
                        <td style="font-size: 0.82rem; max-width: 200px;">${row.description}</td>
                        <td><strong>$${parseFloat(row.total_amount).toFixed(2)}</strong></td>
                        <td style="font-size: 0.82rem;">${row.installments} de $${parseFloat(row.installment_amount).toFixed(2)}</td>
                        <td>
                            <strong style="color: ${parseFloat(row.pending_amount) > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
                                $${parseFloat(row.pending_amount).toFixed(2)}
                            </strong>
                        </td>
                        <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                    `;
                }
            });
        } else if (this.currentType === 'payroll') {
            titleEl.innerHTML = `<span style="width: 20px; height: 20px;">${Icons.payroll}</span> Vista Previa del Reporte de Nóminas & Dispersiones`;
            thead.innerHTML = `
                <tr>
                    <th>Periodo / Nombre</th>
                    <th>Tipo</th>
                    <th>Rango de Fechas</th>
                    <th>Colaboradores</th>
                    <th>Total Percepciones</th>
                    <th>Total Deducciones</th>
                    <th>Gran Total Neto</th>
                    <th>Estatus</th>
                </tr>
            `;

            this.infinityTable = new InfinityScrollTable({
                containerElement: container,
                tbodyElement: tbody,
                emptyMessage: 'No se encontraron nóminas en el rango de fechas seleccionado.',
                fetchDataFunction: async (page, limit) => {
                    const res = await API.get('/reports/preview', {
                        type: 'payroll',
                        start_date: this.currentStartDate,
                        end_date: this.currentEndDate,
                        page,
                        limit
                    });
                    this.updateCountIndicator(res);
                    return res;
                },
                renderRowFunction: (row) => {
                    return `
                        <td>
                            <strong>${row.period_name}</strong>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${row.closed_at ? `Cerrada: ${row.closed_at}` : 'En proceso'}</div>
                        </td>
                        <td><span class="badge badge-primary">${(row.period_type || 'quincenal').toUpperCase()}</span></td>
                        <td style="font-family: monospace; font-size: 0.85rem;">${row.start_date} al ${row.end_date}</td>
                        <td><strong>${row.employees_count || 0}</strong></td>
                        <td style="color: var(--color-success); font-weight: 700;">$${parseFloat(row.total_perceptions).toFixed(2)}</td>
                        <td style="color: var(--color-danger); font-weight: 700;">-$${parseFloat(row.total_deductions).toFixed(2)}</td>
                        <td><strong style="color: var(--color-primary); font-size: 1rem;">$${parseFloat(row.net_total).toFixed(2)}</strong></td>
                        <td><span class="badge ${row.status === 'closed' ? 'badge-success' : 'badge-warning'}">${row.status === 'closed' ? 'Cerrada' : 'Borrador'}</span></td>
                    `;
                }
            });
        } else if (this.currentType === 'payroll_details') {
            titleEl.innerHTML = `<span style="width: 20px; height: 20px;">${Icons.payroll}</span> Vista Previa: Desglose de Nómina por Trabajador`;
            thead.innerHTML = `
                <tr>
                    <th>Colaborador</th>
                    <th>Periodo Nómina</th>
                    <th>Días Trab. / Salario</th>
                    <th>Sueldo Base</th>
                    <th>Percepciones Extra</th>
                    <th>Total Bruto</th>
                    <th>Deducciones (IMSS/ISR/Mermas)</th>
                    <th>Neto a Pagar</th>
                </tr>
            `;

            this.infinityTable = new InfinityScrollTable({
                containerElement: container,
                tbodyElement: tbody,
                emptyMessage: 'No se encontraron detalles de nómina por trabajador en el rango de fechas seleccionado.',
                fetchDataFunction: async (page, limit) => {
                    const res = await API.get('/reports/preview', {
                        type: 'payroll_details',
                        start_date: this.currentStartDate,
                        end_date: this.currentEndDate,
                        page,
                        limit
                    });
                    this.updateCountIndicator(res);
                    return res;
                },
                renderRowFunction: (row) => {
                    const extras = (parseFloat(row.overtime_pay || row.overtime_amount || 0) + parseFloat(row.holiday_pay || row.holiday_amount || 0) + parseFloat(row.bonus || row.bonus_amount || 0) + parseFloat(row.commissions || 0) + parseFloat(row.vacation_bonus || row.vacation_amount || 0) + parseFloat(row.christmas_bonus || 0));
                    const net = parseFloat(row.net_pay || row.net_salary_resolved || row.net_salary || 0);
                    return `
                        <td>
                            <strong>${row.first_name} ${row.last_name}</strong>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">${row.employee_code} · ${row.position_name || 'Sin Puesto'}</div>
                        </td>
                        <td>
                            <div style="font-weight: 600;">${row.period_name}</div>
                            <div style="font-size: 0.72rem; color: var(--color-muted); font-family: monospace;">${row.period_start_date} al ${row.period_end_date}</div>
                        </td>
                        <td>
                            <div><strong>${parseFloat(row.days_worked || 0).toFixed(1)}</strong> días</div>
                            <div style="font-size: 0.75rem; color: var(--color-muted);">$${parseFloat(row.emp_daily_salary || row.daily_salary || 0).toFixed(2)}/día</div>
                        </td>
                        <td><strong>$${parseFloat(row.base_salary || 0).toFixed(2)}</strong></td>
                        <td style="font-size: 0.82rem;">
                            ${extras > 0 ? `<span style="color: var(--color-success); font-weight: 600;">+$${extras.toFixed(2)}</span>` : '<span style="color: var(--color-muted);">$0.00</span>'}
                        </td>
                        <td style="color: var(--color-success); font-weight: 700;">$${parseFloat(row.total_perceptions || 0).toFixed(2)}</td>
                        <td style="color: var(--color-danger); font-weight: 700;">-$${parseFloat(row.total_deductions || 0).toFixed(2)}</td>
                        <td><strong style="color: var(--color-primary); font-size: 1.05rem;">$${net.toFixed(2)}</strong></td>
                    `;
                }
            });
        }

        this.infinityTable.loadNextPage();
    },

    updateCountIndicator(res) {
        const indicator = document.getElementById('report-count-indicator');
        if (!indicator) return;
        const total = res?.pagination?.total || 0;
        if (total === 0) {
            indicator.textContent = '0 registros encontrados';
        } else {
            indicator.textContent = `Total: ${total} registro(s)`;
        }
    },

    async downloadCSV() {
        try {
            Toast.info(`Generando archivo CSV para ${this.currentType.toUpperCase()}...`);
            const token = API.getToken();

            const queryParams = new URLSearchParams({
                type: this.currentType,
                start_date: this.currentStartDate || '',
                end_date: this.currentEndDate || '',
                status: this.currentStatus || ''
            });

            const response = await fetch(`/api/reports/download?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.message || `Error del servidor (${response.status})`);
            }

            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition');
            let filename = `reporte_${this.currentType}_${new Date().toISOString().split('T')[0]}.csv`;

            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename="?([^"]+)"?/i.exec(disposition);
                if (matches && matches[1]) filename = matches[1];
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            Toast.success(`¡Reporte ${filename} descargado exitosamente!`);
        } catch (e) {
            Toast.danger(e.message || 'Error al descargar el archivo CSV.');
        }
    }
};

window.ReportsModule = ReportsModule;
