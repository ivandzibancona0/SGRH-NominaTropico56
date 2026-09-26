// Attendance & Overtime Module with Infinity Scroll
const AttendanceModule = {
    infinityTable: null,

    async render(container) {
        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Registro de Asistencias</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">Control de asistencia, horas extra acumuladas y días festivos laborados.</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btn-open-punch-clock" style="background: var(--color-dark); box-shadow: 0 4px 12px rgba(42,36,33,0.25);">
                        <span style="width: 18px; height: 18px; color: var(--color-gold);">${Icons.clock}</span>
                        <span>Reloj Checador Digital</span>
                    </button>
                    <button class="btn btn-primary" id="btn-open-daily-sheet">
                        <span style="width: 18px; height: 18px;">${Icons.calendar}</span>
                        <span>Pase de Lista Diario</span>
                    </button>
                    <button class="btn btn-secondary" id="btn-single-att">
                        <span style="width: 18px; height: 18px;">${Icons.plus}</span>
                        <span>Registro Individual</span>
                    </button>
                </div>
            </div>

            <!-- Attendance Stats Cards -->
            <div class="kpi-grid" id="att-kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon success">${Icons.check}</div>
                    <div class="kpi-content">
                        <h4>Asistencias Hoy</h4>
                        <div class="kpi-value" id="att-kpi-present">--</div>
                        <div class="kpi-subtext" id="att-kpi-total">Colaboradores presentes</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon warning">${Icons.clock}</div>
                    <div class="kpi-content">
                        <h4>Retardos Hoy</h4>
                        <div class="kpi-value" id="att-kpi-late">--</div>
                        <div class="kpi-subtext">Ingresos fuera de horario</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon primary">${Icons.clock}</div>
                    <div class="kpi-content">
                        <h4>Horas Extra del Mes</h4>
                        <div class="kpi-value" id="att-kpi-ot">--</div>
                        <div class="kpi-subtext">Horas adicionales acumuladas</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon gold">${Icons.calendar}</div>
                    <div class="kpi-content">
                        <h4>Festivos Laborados</h4>
                        <div class="kpi-value" id="att-kpi-holidays">--</div>
                        <div class="kpi-subtext">Turnos especiales en el mes</div>
                    </div>
                </div>
            </div>

            <!-- Single Specific Date Filter with Quick Shortcuts -->
            <div class="filter-bar">
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; flex: 1;">
                    <div class="form-group" style="margin-bottom: 0; min-width: 170px;">
                        <input type="date" id="att-filter-date" class="form-control" title="Seleccionar Fecha Específica">
                    </div>
                    <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-secondary btn-sm" id="att-btn-today" title="Ver asistencias de hoy">Hoy</button>
                        <button class="btn btn-secondary btn-sm" id="att-btn-yesterday" title="Ver asistencias de ayer">Ayer</button>
                        <button class="btn btn-secondary btn-sm" id="att-btn-all" title="Ver todo el historial">Todos</button>
                    </div>
                    <select id="att-filter-status" class="form-control" style="width: 180px;">
                        <option value="">Todos los Estados</option>
                        <option value="present">Presente</option>
                        <option value="late">Retardo</option>
                        <option value="early_departure">Salida Anticipada</option>
                        <option value="vacation">Vacaciones (Con goce)</option>
                        <option value="leave">Permiso / Incapacidad</option>
                        <option value="justified_absence">Falta Justificada</option>
                        <option value="unjustified_absence">Falta Injustificada</option>
                    </select>
                </div>
                <button class="btn btn-secondary btn-sm" id="att-btn-filter">
                    <span style="width: 16px; height: 16px;">${Icons.filter}</span>
                    <span>Filtrar</span>
                </button>
            </div>

            <!-- Table with Infinity Scroll -->
            <div class="table-container" id="attendance-table-container">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Empleado</th>
                                <th>Área & Puesto</th>
                                <th>Entrada / Salida</th>
                                <th>Estatus</th>
                                <th>Horas Extra</th>
                                <th>Día Festivo</th>
                                <th>Notas</th>
                                <th style="text-align: right;">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="attendance-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-open-punch-clock').addEventListener('click', () => PunchClock.open());
        document.getElementById('btn-open-daily-sheet').addEventListener('click', () => this.openDailySheetModal());
        document.getElementById('btn-single-att').addEventListener('click', () => this.openSingleModal());
        document.getElementById('att-btn-filter').addEventListener('click', () => this.infinityTable.resetAndLoad());

        // Quick date shortcuts
        const dateInput = document.getElementById('att-filter-date');
        const statusSelect = document.getElementById('att-filter-status');

        document.getElementById('att-btn-today').addEventListener('click', () => {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            this.infinityTable.resetAndLoad();
        });

        document.getElementById('att-btn-yesterday').addEventListener('click', () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            dateInput.value = d.toISOString().split('T')[0];
            this.infinityTable.resetAndLoad();
        });

        document.getElementById('att-btn-all').addEventListener('click', () => {
            dateInput.value = '';
            statusSelect.value = '';
            this.infinityTable.resetAndLoad();
        });

        dateInput.addEventListener('change', () => this.infinityTable.resetAndLoad());
        statusSelect.addEventListener('change', () => this.infinityTable.resetAndLoad());

        await this.loadStats();
        this.initInfinityScroll();
    },

    async loadStats() {
        try {
            const res = await API.get('/attendance/stats');
            if (res.success) {
                const s = res.data;
                document.getElementById('att-kpi-present').textContent = s.present_today;
                document.getElementById('att-kpi-total').textContent = `De ${s.total_active} activos`;
                document.getElementById('att-kpi-late').textContent = s.late_today;
                document.getElementById('att-kpi-ot').textContent = `${s.monthly_overtime_hours} hrs`;
                document.getElementById('att-kpi-holidays').textContent = `${s.monthly_holidays_worked} días`;
            }
        } catch (e) {
            console.error('Error al cargar estadísticas de asistencia:', e);
        }
    },

    initInfinityScroll() {
        const container = document.getElementById('attendance-table-container');
        const tbody = document.getElementById('attendance-tbody');

        this.infinityTable = new InfinityScrollTable({
            containerElement: container,
            tbodyElement: tbody,
            emptyMessage: 'No hay registros de asistencia para la fecha o filtros seleccionados.',
            fetchDataFunction: async (page, limit) => {
                const date = document.getElementById('att-filter-date')?.value || '';
                const status = document.getElementById('att-filter-status')?.value || '';

                return await API.get('/attendance', {
                    page,
                    limit,
                    date,
                    status
                });
            },
            renderRowFunction: (row) => {
                let badgeClass = 'badge-success';
                let statusLabel = 'Presente';
                if (row.status === 'late') { badgeClass = 'badge-warning'; statusLabel = 'Retardo'; }
                if (row.status === 'early_departure') { badgeClass = 'badge-warning'; statusLabel = 'Salida Antic.'; }
                if (row.status === 'vacation') { badgeClass = 'badge-gold'; statusLabel = 'Vacaciones'; }
                if (row.status === 'leave') { badgeClass = 'badge-info'; statusLabel = 'Permiso'; }
                if (row.status === 'justified_absence') { badgeClass = 'badge-info'; statusLabel = 'Falta Just.'; }
                if (row.status === 'unjustified_absence') { badgeClass = 'badge-danger'; statusLabel = 'Falta Injust.'; }

                const rowDataAttr = encodeURIComponent(JSON.stringify(row));

                return `
                    <td><strong>${row.date}</strong></td>
                    <td>
                        <strong>${row.first_name} ${row.last_name}</strong>
                        <div style="font-size: 0.75rem; color: var(--color-muted); font-family: monospace;">${row.code}</div>
                    </td>
                    <td>
                        <div>${row.position_name}</div>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">${row.department_name}</div>
                    </td>
                    <td>
                        <span style="font-family: monospace; font-size: 0.85rem;">
                            ${row.check_in ? row.check_in.substring(0, 5) : '--:--'} - ${row.check_out ? row.check_out.substring(0, 5) : '--:--'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">${statusLabel}</span>
                    </td>
                    <td>
                        ${parseFloat(row.overtime_hours) > 0 ? `<strong style="color: var(--color-primary);">${row.overtime_hours} hrs</strong>` : '<span style="color: var(--color-muted);">-</span>'}
                    </td>
                    <td>
                        ${row.is_holiday_worked ? `<span class="badge badge-gold">Sí (Festivo)</span>` : '<span style="color: var(--color-muted);">No</span>'}
                    </td>
                    <td style="font-size: 0.8rem; color: var(--color-muted); max-width: 180px;">
                        ${row.notes || '-'}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="AttendanceModule.openEditModal('${rowDataAttr}')" title="Modificar Salida / Estatus">
                            <span style="width: 14px; height: 14px;">${Icons.edit}</span>
                            <span>Editar</span>
                        </button>
                    </td>
                `;
            }
        });

        this.infinityTable.loadNextPage();
    },

    async openDailySheetModal() {
        const today = new Date().toISOString().split('T')[0];

        try {
            const res = await API.get('/attendance/daily-sheet', { date: today });
            const sheetData = res.data || [];

            const content = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label style="font-weight: 600;">Fecha de Pase:</label>
                            <input type="date" id="sheet-date-picker" class="form-control" value="${today}" style="width: 170px;">
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary btn-sm" id="btn-mark-all-present">Marcar Todos Presentes</button>
                        </div>
                    </div>

                    <div style="max-height: 520px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Estatus</th>
                                    <th>Entrada</th>
                                    <th>Salida</th>
                                    <th>Horas Extra</th>
                                    <th>Festivo</th>
                                </tr>
                            </thead>
                            <tbody id="sheet-table-body">
                                ${sheetData.map((emp) => `
                                    <tr data-emp-id="${emp.employee_id}">
                                        <td>
                                            <strong>${emp.first_name} ${emp.last_name}</strong>
                                            <div style="font-size: 0.75rem; color: var(--color-muted);">${emp.position_name} (${emp.department_name})</div>
                                        </td>
                                        <td>
                                            <select class="form-control sheet-status" style="width: 145px; padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                                                <option value="" ${!emp.status ? 'selected' : ''}>-- Sin Registro --</option>
                                                <option value="present" ${emp.status === 'present' ? 'selected' : ''}>Presente</option>
                                                <option value="late" ${emp.status === 'late' ? 'selected' : ''}>Retardo</option>
                                                <option value="early_departure" ${emp.status === 'early_departure' ? 'selected' : ''}>Salida Anticipada</option>
                                                <option value="vacation" ${emp.status === 'vacation' ? 'selected' : ''}>Vacaciones</option>
                                                <option value="leave" ${emp.status === 'leave' ? 'selected' : ''}>Permiso / Incap.</option>
                                                <option value="justified_absence" ${emp.status === 'justified_absence' ? 'selected' : ''}>Falta Justificada</option>
                                                <option value="unjustified_absence" ${emp.status === 'unjustified_absence' ? 'selected' : ''}>Falta Injustificada</option>
                                            </select>
                                            ${emp.is_on_vacation ? '<div style="font-size: 0.68rem; color: var(--color-gold-hover); font-weight: 700;">★ Vacaciones Aprobadas</div>' : ''}
                                        </td>
                                        <td>
                                            <input type="time" class="form-control sheet-in" value="${emp.check_in ? emp.check_in.substring(0, 5) : ''}" placeholder="--:--" style="width: 95px; padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                                        </td>
                                        <td>
                                            <input type="time" class="form-control sheet-out" value="${emp.check_out ? emp.check_out.substring(0, 5) : ''}" placeholder="--:--" style="width: 95px; padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                                        </td>
                                        <td>
                                            <input type="number" step="0.5" class="form-control sheet-ot" value="${emp.overtime_hours || 0}" style="width: 70px; padding: 0.35rem 0.5rem; font-size: 0.8rem; text-align: center;">
                                        </td>
                                        <td style="text-align: center;">
                                            <input type="checkbox" class="sheet-holiday" ${emp.is_holiday_worked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-primary);">
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" id="btn-save-daily-sheet">Guardar Pase de Lista</button>
            `;

            Modal.open({
                title: 'Pase de Lista Diario y Registro Masivo',
                content,
                size: 'xl',
                footer
            });

            // "Mark all present" button fills active un-vacationed rows
            document.getElementById('btn-mark-all-present').addEventListener('click', () => {
                document.querySelectorAll('#sheet-table-body tr').forEach(tr => {
                    const statusSelect = tr.querySelector('.sheet-status');
                    const inInput = tr.querySelector('.sheet-in');
                    const outInput = tr.querySelector('.sheet-out');

                    if (statusSelect.value !== 'vacation') {
                        statusSelect.value = 'present';
                        if (!inInput.value) inInput.value = '09:00';
                        if (!outInput.value) outInput.value = '17:00';
                    }
                });
            });

            // Date picker change
            document.getElementById('sheet-date-picker').addEventListener('change', async (e) => {
                const newDate = e.target.value;
                const newRes = await API.get('/attendance/daily-sheet', { date: newDate });
                AttendanceModule.updateSheetBody(newRes.data || []);
            });

            // Status select change delegation for intelligent time auto-fill / clear
            document.getElementById('sheet-table-body').addEventListener('change', (e) => {
                if (e.target.classList.contains('sheet-status')) {
                    const tr = e.target.closest('tr');
                    const inInput = tr.querySelector('.sheet-in');
                    const outInput = tr.querySelector('.sheet-out');
                    const val = e.target.value;

                    if (val === 'present' || val === 'late') {
                        if (!inInput.value) inInput.value = '09:00';
                        if (!outInput.value) outInput.value = '17:00';
                    } else if (val.includes('absence') || val === 'vacation' || val === 'leave' || !val) {
                        inInput.value = '';
                        outInput.value = '';
                    }
                }
            });

            // Save daily sheet
            document.getElementById('btn-save-daily-sheet').addEventListener('click', async () => {
                const date = document.getElementById('sheet-date-picker').value;
                const rows = document.querySelectorAll('#sheet-table-body tr');
                const records = [];

                rows.forEach(tr => {
                    const empId = tr.getAttribute('data-emp-id');
                    const status = tr.querySelector('.sheet-status').value;
                    // Only include if status is chosen or times provided
                    if (status) {
                        records.push({
                            employee_id: parseInt(empId),
                            status,
                            check_in: tr.querySelector('.sheet-in').value || null,
                            check_out: tr.querySelector('.sheet-out').value || null,
                            overtime_hours: parseFloat(tr.querySelector('.sheet-ot').value) || 0,
                            is_holiday_worked: tr.querySelector('.sheet-holiday').checked ? 1 : 0
                        });
                    }
                });

                if (records.length === 0) {
                    Toast.warning('Selecciona el estatus de al menos un colaborador o usa "Marcar Todos Presentes".');
                    return;
                }

                try {
                    await API.post('/attendance/bulk', { date, records });
                    Toast.success('Pase de lista guardado exitosamente.');
                    Modal.close();
                    await this.loadStats();
                    this.infinityTable.resetAndLoad();
                } catch (err) {
                    Toast.danger(err.message || 'Error al guardar lista de asistencias.');
                }
            });
        } catch (e) {
            Toast.danger('Error al cargar la lista de asistencia.');
        }
    },

    updateSheetBody(sheetData) {
        const tbody = document.getElementById('sheet-table-body');
        if (!tbody) return;
        tbody.innerHTML = sheetData.map((emp) => `
            <tr data-emp-id="${emp.employee_id}">
                <td>
                    <strong>${emp.first_name} ${emp.last_name}</strong>
                    <div style="font-size: 0.75rem; color: var(--color-muted);">${emp.position_name} (${emp.department_name})</div>
                </td>
                <td>
                    <select class="form-control sheet-status" style="width: 145px; padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                        <option value="" ${!emp.status ? 'selected' : ''}>-- Sin Registro --</option>
                        <option value="present" ${emp.status === 'present' ? 'selected' : ''}>Presente</option>
                        <option value="late" ${emp.status === 'late' ? 'selected' : ''}>Retardo</option>
                        <option value="early_departure" ${emp.status === 'early_departure' ? 'selected' : ''}>Salida Anticipada</option>
                        <option value="vacation" ${emp.status === 'vacation' ? 'selected' : ''}>Vacaciones</option>
                        <option value="leave" ${emp.status === 'leave' ? 'selected' : ''}>Permiso / Incap.</option>
                        <option value="justified_absence" ${emp.status === 'justified_absence' ? 'selected' : ''}>Falta Justificada</option>
                        <option value="unjustified_absence" ${emp.status === 'unjustified_absence' ? 'selected' : ''}>Falta Injustificada</option>
                    </select>
                    ${emp.is_on_vacation ? '<div style="font-size: 0.68rem; color: var(--color-gold-hover); font-weight: 700;">★ Vacaciones Aprobadas</div>' : ''}
                </td>
                <td>
                    <input type="time" class="form-control sheet-in" value="${emp.check_in ? emp.check_in.substring(0, 5) : ''}" placeholder="--:--" style="width: 95px; padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                </td>
                <td>
                    <input type="time" class="form-control sheet-out" value="${emp.check_out ? emp.check_out.substring(0, 5) : ''}" placeholder="--:--" style="width: 95px; padding: 0.35rem 0.5rem; font-size: 0.8rem;">
                </td>
                <td>
                    <input type="number" step="0.5" class="form-control sheet-ot" value="${emp.overtime_hours || 0}" style="width: 70px; padding: 0.35rem 0.5rem; font-size: 0.8rem; text-align: center;">
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="sheet-holiday" ${emp.is_holiday_worked ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-primary);">
                </td>
            </tr>
        `).join('');
    },

    async openSingleModal() {
        const empRes = await API.get('/employees', { limit: 100 });
        const employees = empRes.data || [];

        const content = `
            <form id="single-att-form">
                <div class="form-group">
                    <label>Colaborador <span class="required">*</span></label>
                    <select id="s-att-emp" class="form-control" required>
                        <option value="">Selecciona Colaborador</option>
                        ${employees.map(e => `<option value="${e.id}">${e.first_name} ${e.last_name} (${e.code})</option>`).join('')}
                    </select>
                </div>
                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Fecha <span class="required">*</span></label>
                        <input type="date" id="s-att-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Estatus</label>
                        <select id="s-att-status" class="form-control">
                            <option value="present">Presente</option>
                            <option value="early_departure">Salida Anticipada / Permiso Parcial</option>
                            <option value="late">Retardo</option>
                            <option value="vacation">Vacaciones (Con goce)</option>
                            <option value="leave">Permiso / Incapacidad</option>
                            <option value="justified_absence">Falta Justificada</option>
                            <option value="unjustified_absence">Falta Injustificada</option>
                        </select>
                    </div>
                </div>
                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Hora Entrada</label>
                        <input type="time" id="s-att-in" class="form-control" value="09:00">
                    </div>
                    <div class="form-group">
                        <label>Hora Salida</label>
                        <input type="time" id="s-att-out" class="form-control" value="17:00">
                    </div>
                </div>
                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Horas Extra Realizadas</label>
                        <input type="number" step="0.5" id="s-att-ot" class="form-control" value="0" placeholder="0.0">
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem;">
                        <input type="checkbox" id="s-att-holiday" style="width: 20px; height: 20px; accent-color: var(--color-primary);">
                        <label for="s-att-holiday" style="margin-bottom: 0; font-weight: 600; cursor: pointer;">¿Es Día Festivo / Inhábil Laborado?</label>
                    </div>
                </div>
                <div class="form-group">
                    <label>Notas u Observaciones (Motivo de salida anticipada, permiso, etc.)</label>
                    <textarea id="s-att-notes" class="form-control" rows="2" placeholder="Motivo de salida anticipada, justificación, etc."></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-single-att">Guardar Registro</button>
        `;

        Modal.open({
            title: 'Registro Individual de Asistencia / Horas Extra',
            content,
            footer
        });

        document.getElementById('btn-save-single-att').addEventListener('click', async () => {
            const employee_id = document.getElementById('s-att-emp').value;
            const date = document.getElementById('s-att-date').value;
            const status = document.getElementById('s-att-status').value;
            const check_in = document.getElementById('s-att-in').value;
            const check_out = document.getElementById('s-att-out').value;
            const overtime_hours = document.getElementById('s-att-ot').value;
            const is_holiday_worked = document.getElementById('s-att-holiday').checked ? 1 : 0;
            const notes = document.getElementById('s-att-notes').value.trim();

            if (!employee_id || !date) {
                Toast.warning('Empleado y fecha son obligatorios.');
                return;
            }

            try {
                await API.post('/attendance', {
                    employee_id, date, status, check_in, check_out, overtime_hours, is_holiday_worked, notes
                });
                Toast.success('Asistencia registrada correctamente.');
                Modal.close();
                await this.loadStats();
                this.infinityTable.resetAndLoad();
            } catch (err) {
                Toast.danger(err.message || 'Error al registrar asistencia.');
            }
        });
    },

    // -------------------------------------------------------------
    // MODIFICAR ASISTENCIA / SALIDA ANTICIPADA DIRECTA
    // -------------------------------------------------------------
    openEditModal(rowEncoded) {
        let row;
        try {
            row = JSON.parse(decodeURIComponent(rowEncoded));
        } catch (e) {
            Toast.danger('Error al cargar datos del registro.');
            return;
        }

        const content = `
            <form id="edit-att-form">
                <div style="background: var(--color-bg); padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
                    <div style="font-size: 0.8rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700;">Colaborador</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: var(--color-dark);">${row.first_name} ${row.last_name}</div>
                    <div style="font-size: 0.82rem; color: var(--color-muted);">${row.code} · ${row.position_name} (${row.department_name})</div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Fecha de Asistencia</label>
                        <input type="date" id="edit-att-date" class="form-control" value="${row.date}" readonly style="background: var(--color-bg); cursor: not-allowed;">
                    </div>
                    <div class="form-group">
                        <label>Estatus de la Jornada <span class="required">*</span></label>
                        <select id="edit-att-status" class="form-control" required>
                            <option value="present" ${row.status === 'present' ? 'selected' : ''}>Presente</option>
                            <option value="early_departure" ${row.status === 'early_departure' ? 'selected' : ''}>Salida Anticipada / Permiso Parcial</option>
                            <option value="late" ${row.status === 'late' ? 'selected' : ''}>Retardo</option>
                            <option value="vacation" ${row.status === 'vacation' ? 'selected' : ''}>Vacaciones (Con goce)</option>
                            <option value="leave" ${row.status === 'leave' ? 'selected' : ''}>Permiso / Incapacidad</option>
                            <option value="justified_absence" ${row.status === 'justified_absence' ? 'selected' : ''}>Falta Justificada</option>
                            <option value="unjustified_absence" ${row.status === 'unjustified_absence' ? 'selected' : ''}>Falta Injustificada</option>
                        </select>
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Hora de Entrada</label>
                        <input type="time" id="edit-att-in" class="form-control" value="${row.check_in ? row.check_in.substring(0, 5) : '09:00'}">
                    </div>
                    <div class="form-group">
                        <label>Hora Real de Salida</label>
                        <input type="time" id="edit-att-out" class="form-control" value="${row.check_out ? row.check_out.substring(0, 5) : '17:00'}">
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Horas Extra Realizadas</label>
                        <input type="number" step="0.5" id="edit-att-ot" class="form-control" value="${parseFloat(row.overtime_hours) || 0}">
                    </div>
                    <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem;">
                        <input type="checkbox" id="edit-att-holiday" ${row.is_holiday_worked ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: var(--color-primary);">
                        <label for="edit-att-holiday" style="margin-bottom: 0; font-weight: 600; cursor: pointer;">¿Día Festivo / Inhábil Laborado?</label>
                    </div>
                </div>

                <div class="form-group">
                    <label>Notas / Motivo de Modificación o Salida Anticipada</label>
                    <textarea id="edit-att-notes" class="form-control" rows="2" placeholder="Ej: Se retiró a las 14:00 por cita médica autorizada...">${row.notes || ''}</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-edit-att">Actualizar Registro</button>
        `;

        Modal.open({
            title: 'Modificar Registro de Asistencia / Salida Anticipada',
            content,
            footer
        });

        document.getElementById('btn-save-edit-att').addEventListener('click', async () => {
            const employee_id = row.employee_id;
            const date = document.getElementById('edit-att-date').value;
            const status = document.getElementById('edit-att-status').value;
            const check_in = document.getElementById('edit-att-in').value;
            const check_out = document.getElementById('edit-att-out').value;
            const overtime_hours = document.getElementById('edit-att-ot').value;
            const is_holiday_worked = document.getElementById('edit-att-holiday').checked ? 1 : 0;
            const notes = document.getElementById('edit-att-notes').value.trim();

            try {
                await API.post('/attendance', {
                    employee_id, date, status, check_in, check_out, overtime_hours, is_holiday_worked, notes
                });
                Toast.success('Asistencia actualizada correctamente.');
                Modal.close();
                await this.loadStats();
                this.infinityTable.resetAndLoad();
            } catch (err) {
                Toast.danger(err.message || 'Error al actualizar asistencia.');
            }
        });
    }
};

window.AttendanceModule = AttendanceModule;
