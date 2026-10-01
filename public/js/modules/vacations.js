// Vacations & LFT Tabulation Module
const VacationsModule = {
    infinityTable: null,
    employeesBalance: [],
    lftRules: [],

    async render(container) {
        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Control de Vacaciones (LFT)</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">
                        Antigüedad laboral, saldo de días pendientes y tabulador oficial de la Ley Federal del Trabajo.
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary" id="btn-open-lft-modal">
                        <span style="width: 18px; height: 18px;">${Icons.table}</span>
                        <span>Tabulador LFT (Vacaciones Dignas)</span>
                    </button>
                    <button class="btn btn-primary" id="btn-request-vacation">
                        <span style="width: 18px; height: 18px;">${Icons.plus}</span>
                        <span>Solicitar Periodo Vacacional</span>
                    </button>
                </div>
            </div>

            <!-- Vacation Balance Grid / Cards -->
            <div class="card" style="margin-bottom: 1.5rem;">
                <div class="card-header">
                    <h3><span style="width: 20px; height: 20px;">${Icons.vacations}</span> Balance y Derecho Vacacional por Colaborador</h3>
                    <span class="badge badge-primary" id="vac-total-eligible">0 con derecho</span>
                </div>
                
                <div class="table-container" style="border: none; box-shadow: none;">
                    <div class="table-responsive" style="max-height: 380px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Fecha Ingreso / Antigüedad</th>
                                    <th>Derecho LFT</th>
                                    <th>Días Otorgados</th>
                                    <th>Días Disfrutados</th>
                                    <th>Días Pendientes</th>
                                    <th>Prima Vacacional Est. (25%)</th>
                                    <th style="text-align: right;">Acción</th>
                                </tr>
                            </thead>
                            <tbody id="vac-balance-tbody">
                                <tr><td colspan="8" class="table-empty-state"><div class="spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Vacation Requests History Section -->
            <div class="card">
                <div class="card-header">
                    <h3><span style="width: 20px; height: 20px;">${Icons.calendar}</span> Historial de Periodos Vacacionales Solicitados</h3>
                </div>

                <div class="table-container" id="vac-history-container" style="border: none; box-shadow: none;">
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Colaborador</th>
                                    <th>Periodo (Inicio - Fin)</th>
                                    <th>Días Solicitados</th>
                                    <th>% Prima Vacacional</th>
                                    <th>Estatus</th>
                                    <th>Notas</th>
                                    <th style="text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="vac-history-tbody"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-open-lft-modal').addEventListener('click', () => this.openLFTTabulatorModal());
        document.getElementById('btn-request-vacation').addEventListener('click', () => this.openRequestModal());

        await this.loadBalanceData();
        this.initHistoryInfinityScroll();
    },

    async loadBalanceData() {
        try {
            const res = await API.get('/vacations/employees-balance');
            this.employeesBalance = res.data || [];

            const tbody = document.getElementById('vac-balance-tbody');
            const eligibleCount = this.employeesBalance.filter(e => e.is_eligible).length;
            document.getElementById('vac-total-eligible').textContent = `${eligibleCount} con derecho`;

            if (this.employeesBalance.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="table-empty-state"><p>No hay colaboradores registrados.</p></td></tr>`;
                return;
            }

            tbody.innerHTML = this.employeesBalance.map(emp => `
                <tr>
                    <td>
                        <strong>${emp.name}</strong>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">${emp.position_name} (${emp.department_name})</div>
                    </td>
                    <td>
                        <div style="font-weight: 600;">${emp.seniority_label}</div>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">Ingreso: ${emp.hire_date}</div>
                    </td>
                    <td>
                        ${emp.is_eligible 
                            ? `<span class="badge badge-success"><span class="badge-dot"></span>Con Derecho</span>` 
                            : `<span class="badge badge-warning"><span class="badge-dot"></span>< 1 Año Antigüedad</span>`}
                    </td>
                    <td><strong style="color: var(--color-dark);">${emp.earned_days} días</strong></td>
                    <td><span style="color: var(--color-muted);">${emp.taken_days} días</span></td>
                    <td>
                        <strong style="color: ${emp.remaining_days > 0 ? 'var(--color-primary)' : 'var(--color-muted)'}; font-size: 1rem;">
                            ${emp.remaining_days} días
                        </strong>
                    </td>
                    <td>
                        <strong>$${parseFloat(emp.estimated_vacation_bonus).toFixed(2)} MXN</strong>
                    </td>
                    <td style="text-align: right;">
                        <button class="btn btn-primary btn-sm" onclick="VacationsModule.openRequestModal(${emp.id})" ${!emp.is_eligible || emp.remaining_days <= 0 ? 'disabled' : ''}>
                            Programar
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            console.error('Error al cargar balance vacacional:', e);
            Toast.danger('Error al consultar balance de vacaciones.');
        }
    },

    initHistoryInfinityScroll() {
        const container = document.getElementById('vac-history-container');
        const tbody = document.getElementById('vac-history-tbody');

        this.infinityTable = new InfinityScrollTable({
            containerElement: container,
            tbodyElement: tbody,
            emptyMessage: 'No hay solicitudes de vacaciones registradas.',
            fetchDataFunction: async (page, limit) => {
                return await API.get('/vacations/requests', { page, limit });
            },
            renderRowFunction: (row) => {
                let badgeClass = 'badge-success';
                let label = 'Aprobada';
                if (row.status === 'pending') { badgeClass = 'badge-warning'; label = 'Pendiente'; }
                if (row.status === 'rejected') { badgeClass = 'badge-danger'; label = 'Rechazada'; }

                return `
                    <td>
                        <strong>${row.first_name} ${row.last_name}</strong>
                        <div style="font-size: 0.75rem; color: var(--color-muted);">${row.code} · ${row.position_name}</div>
                    </td>
                    <td>
                        <span style="font-family: monospace; font-weight: 600;">${row.start_date}</span> al <span style="font-family: monospace; font-weight: 600;">${row.end_date}</span>
                    </td>
                    <td>
                        <strong style="color: var(--color-primary);">${row.days_requested} días hábiles</strong>
                    </td>
                    <td>
                        <span class="badge badge-info">${parseFloat(row.vacation_pay_percentage).toFixed(0)}%</span>
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">${label}</span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--color-muted); max-width: 200px;">
                        ${row.notes || '-'}
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        ${Auth.isAdmin() ? `
                            ${row.status === 'pending' ? `
                                <button class="btn btn-secondary btn-sm" onclick="VacationsModule.updateStatus(${row.id}, 'approved')" title="Aprobar Solicitud">
                                    <span style="width: 14px; height: 14px;">${Icons.check}</span>
                                </button>
                                <button class="btn btn-outline-danger btn-sm" onclick="VacationsModule.updateStatus(${row.id}, 'rejected')" title="Rechazar Solicitud">
                                    <span style="width: 14px; height: 14px;">${Icons.x}</span>
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary btn-sm" onclick="VacationsModule.openEditModal(${row.id})" title="Modificar o Corregir Periodo Vacacional">
                                <span style="width: 14px; height: 14px;">${Icons.edit}</span>
                            </button>
                        ` : `
                            <span style="font-size: 0.75rem; color: var(--color-muted);">${row.status === 'pending' ? 'En espera' : 'Procesado'}</span>
                        `}
                    </td>
                `;
            }
        });

        this.infinityTable.loadNextPage();
    },

    // -------------------------------------------------------------
    // POPUP TABULADOR LFT (Ley Federal del Trabajo)
    // -------------------------------------------------------------
    async openLFTTabulatorModal() {
        try {
            const res = await API.get('/vacations/lft-rules');
            this.lftRules = res.data || [];

            const content = `
                <div>
                    <div style="background: var(--color-primary-light); padding: 0.85rem 1.15rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-size: 0.85rem; color: var(--color-dark);">
                        <strong>Reforma "Vacaciones Dignas" - Ley Federal del Trabajo (LFT):</strong><br>
                        A partir del primer año cumplido de servicios, los trabajadores disfrutarán de un periodo anual de vacaciones pagadas que no podrá ser inferior a 12 días laborables, aumentando dos días laborables por cada año subsecuente de servicios, hasta llegar a 20.
                    </div>

                    <table class="lft-table">
                        <thead>
                            <tr>
                                <th>Rango de Antigüedad (Años)</th>
                                <th style="text-align: center;">Días de Vacaciones por Ley</th>
                            </tr>
                        </thead>
                        <tbody id="lft-rules-tbody">
                            ${this.lftRules.map((rule, idx) => `
                                <tr>
                                    <td>
                                        <strong>${rule.years_min === rule.years_max ? `${rule.years_min} año de antigüedad` : `De ${rule.years_min} a ${rule.years_max} años`}</strong>
                                        <input type="hidden" class="lft-min" value="${rule.years_min}">
                                        <input type="hidden" class="lft-max" value="${rule.years_max}">
                                    </td>
                                    <td style="text-align: center;">
                                        <input type="number" min="1" max="60" class="lft-input-days lft-days" value="${rule.vacation_days}">
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="Modal.close()">Cerrar</button>
                <button class="btn btn-primary" id="btn-save-lft">Guardar Tabulador</button>
            `;

            Modal.open({
                title: 'Tabulación Oficial de Vacaciones según Antigüedad (LFT)',
                content,
                size: 'lg',
                footer
            });

            document.getElementById('btn-save-lft').addEventListener('click', async () => {
                const rows = document.querySelectorAll('#lft-rules-tbody tr');
                const rules = [];
                rows.forEach(tr => {
                    rules.push({
                        years_min: parseInt(tr.querySelector('.lft-min').value),
                        years_max: parseInt(tr.querySelector('.lft-max').value),
                        vacation_days: parseInt(tr.querySelector('.lft-days').value)
                    });
                });

                try {
                    await API.put('/vacations/lft-rules', { rules });
                    Toast.success('Tabulador LFT actualizado exitosamente.');
                    Modal.close();
                    await this.loadBalanceData();
                } catch (err) {
                    Toast.danger(err.message || 'Error al guardar tabulador LFT.');
                }
            });
        } catch (e) {
            Toast.danger('Error al consultar tabulador LFT.');
        }
    },

    // -------------------------------------------------------------
    // CÁLCULO DINÁMICO DE DÍAS HÁBILES SEGÚN DESCANSO DEL EXPEDIENTE
    // -------------------------------------------------------------
    calculateVacationDays(startDateStr, endDateStr, restDayName) {
        if (!startDateStr || !endDateStr) return 0;
        const [sY, sM, sD] = startDateStr.split('-').map(Number);
        const [eY, eM, eD] = endDateStr.split('-').map(Number);
        const start = new Date(sY, sM - 1, sD, 12, 0, 0);
        const end = new Date(eY, eM - 1, eD, 12, 0, 0);
        if (end < start) return 0;

        const dayMap = {
            'domingo': 0,
            'lunes': 1,
            'martes': 2,
            'miércoles': 3,
            'miercoles': 3,
            'jueves': 4,
            'viernes': 5,
            'sábado': 6,
            'sabado': 6
        };

        const cleanRest = (restDayName || '').toLowerCase().trim();
        const restDayIdx = dayMap[cleanRest] !== undefined ? dayMap[cleanRest] : null;

        let count = 0;
        let curr = new Date(start);
        while (curr <= end) {
            const dow = curr.getDay();
            // Descontar únicamente el día de descanso asignado en el expediente
            if (restDayIdx === null || dow !== restDayIdx) {
                count++;
            }
            curr.setDate(curr.getDate() + 1);
        }
        return count;
    },

    // -------------------------------------------------------------
    // MODAL REGISTRO DE PERIODO VACACIONAL
    // -------------------------------------------------------------
    openRequestModal(empId = null) {
        const eligibleEmployees = this.employeesBalance.filter(e => e.is_eligible && e.remaining_days > 0);

        if (eligibleEmployees.length === 0) {
            Toast.warning('No hay colaboradores con saldo de vacaciones disponible en este momento.');
            return;
        }

        const selectedEmp = empId ? this.employeesBalance.find(e => e.id === empId) : eligibleEmployees[0];

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const defaultEnd = new Date(today.getTime() + 6 * 86400000);
        const defaultEndStr = `${defaultEnd.getFullYear()}-${String(defaultEnd.getMonth() + 1).padStart(2, '0')}-${String(defaultEnd.getDate()).padStart(2, '0')}`;

        const content = `
            <form id="vac-req-form">
                <div class="form-group">
                    <label>Colaborador <span class="required">*</span></label>
                    <select id="v-req-emp" class="form-control" required>
                        ${eligibleEmployees.map(e => `
                            <option value="${e.id}" ${selectedEmp && selectedEmp.id === e.id ? 'selected' : ''}>
                                ${e.name} (${e.seniority_years} años de antig. · ${e.remaining_days} días pendientes)
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Live Balance Info Box -->
                <div id="v-balance-info" style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; border: 1px solid var(--color-border);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; gap: 0.5rem;">
                        <div>
                            <span style="font-size: 0.72rem; color: var(--color-muted); text-transform: uppercase;">Días Ganados (LFT)</span>
                            <div style="font-size: 1.15rem; font-weight: 700;" id="v-earned-val">${selectedEmp ? selectedEmp.earned_days : 0}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--color-muted); text-transform: uppercase;">Días Ya Tomados</span>
                            <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-muted);" id="v-taken-val">${selectedEmp ? selectedEmp.taken_days : 0}</div>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--color-primary); text-transform: uppercase; font-weight: 700;">Días Pendientes</span>
                            <div style="font-size: 1.3rem; font-weight: 800; color: var(--color-primary);" id="v-remaining-val">${selectedEmp ? selectedEmp.remaining_days : 0}</div>
                        </div>
                    </div>
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--color-border); display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
                        <span style="color: var(--color-muted);">Día de descanso semanal en expediente:</span>
                        <strong id="v-emp-rest-day-label" style="color: var(--color-primary);">${selectedEmp && selectedEmp.rest_day ? selectedEmp.rest_day : 'No asignado'}</strong>
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Fecha de Inicio <span class="required">*</span></label>
                        <input type="date" id="v-req-start" min="${todayStr}" class="form-control" value="${todayStr}" required>
                    </div>
                    <div class="form-group">
                        <label>Fecha de Término <span class="required">*</span></label>
                        <input type="date" id="v-req-end" min="${todayStr}" class="form-control" value="${defaultEndStr}" required>
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Días Solicitados <span class="required">*</span></label>
                        <input type="number" min="1" id="v-req-days" class="form-control" value="0" readonly style="background: var(--color-bg); font-weight: 700; cursor: not-allowed;" required>
                        <small style="color: var(--color-muted); font-size: 0.75rem; display: block; margin-top: 0.25rem;">Calculado automáticamente descontando el día de descanso del expediente.</small>
                    </div>
                    <div class="form-group">
                        <label>% Prima Vacacional Aplicable</label>
                        <input type="number" step="1" id="v-req-pct" class="form-control" value="25" placeholder="25%">
                    </div>
                </div>

                <div id="v-days-warning" style="display: none; background: var(--color-danger-bg, #FEE2E2); color: var(--color-danger, #DC2626); padding: 0.65rem 1rem; border-radius: var(--radius-md); font-size: 0.82rem; margin-bottom: 1rem; border: 1px solid rgba(220, 38, 38, 0.2);"></div>

                <div class="form-group">
                    <label>Notas / Observaciones</label>
                    <textarea id="v-req-notes" class="form-control" rows="2" placeholder="Detalles de la aprobación o suplencias de turno"></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-vac-req">Aprobar Periodo Vacacional</button>
        `;

        Modal.open({
            title: 'Agregar Periodo Vacacional',
            content,
            footer
        });

        const recalculateDays = () => {
            const empIdVal = parseInt(document.getElementById('v-req-emp').value);
            const emp = this.employeesBalance.find(em => em.id === empIdVal);
            const startInput = document.getElementById('v-req-start');
            const endInput = document.getElementById('v-req-end');
            const daysInput = document.getElementById('v-req-days');
            const warningBox = document.getElementById('v-days-warning');
            const submitBtn = document.getElementById('btn-save-vac-req');
            const restLabel = document.getElementById('v-emp-rest-day-label');

            if (!emp) return;

            if (restLabel) {
                restLabel.textContent = emp.rest_day || 'No asignado';
            }

            const startVal = startInput.value;
            let endVal = endInput.value;

            // Validación: No permitir fecha de inicio en el pasado
            if (startVal && startVal < todayStr) {
                Toast.warning('No se pueden programar vacaciones en fechas pasadas.');
                startInput.value = todayStr;
            }

            // Validación: Fecha de fin nunca inferior a la de inicio
            if (startInput.value) {
                endInput.min = startInput.value;
                if (endVal && endVal < startInput.value) {
                    endInput.value = startInput.value;
                    endVal = startInput.value;
                }
            }

            // Cálculo dinámico utilizando el rest_day del expediente de este colaborador
            const calculatedDays = this.calculateVacationDays(startInput.value, endInput.value, emp.rest_day);
            daysInput.value = calculatedDays;

            // Validación: Días solicitados nunca superiores a los disponibles
            const remaining = emp.remaining_days || 0;
            if (calculatedDays > remaining) {
                warningBox.style.display = 'block';
                warningBox.innerHTML = `⚠️ Los días calculados (<strong>${calculatedDays} días</strong>) superan los días disponibles de este colaborador (<strong>${remaining} días pendientes</strong>).`;
                submitBtn.disabled = true;
            } else if (calculatedDays <= 0) {
                warningBox.style.display = 'block';
                warningBox.innerHTML = `⚠️ El rango de fechas seleccionado debe abarcar al menos un día hábil laborable.`;
                submitBtn.disabled = true;
            } else {
                warningBox.style.display = 'none';
                submitBtn.disabled = false;
            }
        };

        // Update live balance info & rest day when employee select changes
        document.getElementById('v-req-emp').addEventListener('change', (e) => {
            const emp = this.employeesBalance.find(em => em.id === parseInt(e.target.value));
            if (emp) {
                document.getElementById('v-earned-val').textContent = emp.earned_days;
                document.getElementById('v-taken-val').textContent = emp.taken_days;
                document.getElementById('v-remaining-val').textContent = emp.remaining_days;
            }
            recalculateDays();
        });

        document.getElementById('v-req-start').addEventListener('change', recalculateDays);
        document.getElementById('v-req-start').addEventListener('input', recalculateDays);
        document.getElementById('v-req-end').addEventListener('change', recalculateDays);
        document.getElementById('v-req-end').addEventListener('input', recalculateDays);

        // Run calculation once upon opening modal
        recalculateDays();

        document.getElementById('btn-save-vac-req').addEventListener('click', async () => {
            const empIdVal = parseInt(document.getElementById('v-req-emp').value);
            const emp = this.employeesBalance.find(em => em.id === empIdVal);
            const employee_id = document.getElementById('v-req-emp').value;
            const start_date = document.getElementById('v-req-start').value;
            const end_date = document.getElementById('v-req-end').value;
            const days_requested = parseInt(document.getElementById('v-req-days').value);
            const vacation_pay_percentage = document.getElementById('v-req-pct').value;
            const notes = document.getElementById('v-req-notes').value.trim();

            if (!employee_id || !start_date || !end_date || !days_requested) {
                Toast.warning('Completa todos los campos obligatorios.');
                return;
            }

            if (start_date < todayStr) {
                Toast.warning('No se pueden programar vacaciones en fechas pasadas.');
                return;
            }

            if (end_date < start_date) {
                Toast.warning('La fecha de fin del periodo vacacional no puede ser inferior a la de inicio.');
                return;
            }

            if (emp && days_requested > emp.remaining_days) {
                Toast.warning(`Los días solicitados (${days_requested}) superan los días disponibles (${emp.remaining_days}).`);
                return;
            }

            if (days_requested <= 0) {
                Toast.warning('Debe solicitar al menos un día hábil laborable.');
                return;
            }

            try {
                await API.post('/vacations/requests', {
                    employee_id, start_date, end_date, days_requested, vacation_pay_percentage, notes
                });
                Toast.success('Periodo vacacional registrado con éxito.');
                Modal.close();
                await this.loadBalanceData();
                this.infinityTable.resetAndLoad();
            } catch (err) {
                Toast.danger(err.message || 'Error al solicitar vacaciones.');
            }
        });
    },

    // -------------------------------------------------------------
    // MODAL MODIFICAR / CORREGIR PERIODO VACACIONAL (Solo Administrador)
    // -------------------------------------------------------------
    async openEditModal(requestId) {
        if (!Auth.isAdmin()) {
            Toast.warning('Solo los administradores tienen permiso para modificar periodos vacacionales.');
            return;
        }

        try {
            const res = await API.get(`/vacations/requests/${requestId}`);
            const reqData = res.data;
            const emp = this.employeesBalance.find(em => em.id === reqData.employee_id) || {
                remaining_days: 30,
                rest_day: reqData.rest_day || null
            };

            const content = `
                <form id="edit-vac-form">
                    <div style="background: var(--color-bg); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; border: 1px solid var(--color-border); font-size: 0.85rem;">
                        <div style="font-weight: 700; font-size: 1rem; color: var(--color-dark);">${reqData.first_name} ${reqData.last_name} (${reqData.code})</div>
                        <div style="color: var(--color-muted);">${reqData.position_name} · ${reqData.department_name}</div>
                        <div style="margin-top: 0.5rem; display: flex; justify-content: space-between;">
                            <span>Día de descanso en expediente: <strong style="color: var(--color-primary);">${reqData.rest_day || emp.rest_day || 'No asignado'}</strong></span>
                            <span>Estatus: <strong style="text-transform: capitalize;">${reqData.status}</strong></span>
                        </div>
                    </div>

                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Fecha de Inicio <span class="required">*</span></label>
                            <input type="date" id="v-edit-start" class="form-control" value="${reqData.start_date}" required>
                        </div>
                        <div class="form-group">
                            <label>Fecha de Término <span class="required">*</span></label>
                            <input type="date" id="v-edit-end" class="form-control" value="${reqData.end_date}" required>
                        </div>
                    </div>

                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Días Solicitados <span class="required">*</span></label>
                            <input type="number" min="1" id="v-edit-days" class="form-control" value="${reqData.days_requested}" readonly style="background: var(--color-bg); font-weight: 700; cursor: not-allowed;" required>
                            <small style="color: var(--color-muted); font-size: 0.75rem;">Recalculado automáticamente descontando día de descanso.</small>
                        </div>
                        <div class="form-group">
                            <label>% Prima Vacacional</label>
                            <input type="number" step="1" id="v-edit-pct" class="form-control" value="${parseFloat(reqData.vacation_pay_percentage).toFixed(0)}">
                        </div>
                    </div>

                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Estatus de Solicitud</label>
                            <select id="v-edit-status" class="form-control">
                                <option value="approved" ${reqData.status === 'approved' ? 'selected' : ''}>Aprobada</option>
                                <option value="pending" ${reqData.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                                <option value="rejected" ${reqData.status === 'rejected' ? 'selected' : ''}>Rechazada</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Notas / Observaciones</label>
                            <input type="text" id="v-edit-notes" class="form-control" value="${reqData.notes || ''}">
                        </div>
                    </div>

                    <div id="v-edit-warning" style="display: none; background: var(--color-danger-bg, #FEE2E2); color: var(--color-danger, #DC2626); padding: 0.65rem 1rem; border-radius: var(--radius-md); font-size: 0.82rem; margin-top: 0.5rem; border: 1px solid rgba(220, 38, 38, 0.2);"></div>
                </form>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" id="btn-save-edit-vac">Guardar Corrección</button>
            `;

            Modal.open({
                title: `Corregir Periodo Vacacional: ${reqData.first_name} ${reqData.last_name}`,
                content,
                footer
            });

            const recalculateEditDays = () => {
                const startVal = document.getElementById('v-edit-start').value;
                const endInput = document.getElementById('v-edit-end');
                const daysInput = document.getElementById('v-edit-days');
                const warnBox = document.getElementById('v-edit-warning');
                const saveBtn = document.getElementById('btn-save-edit-vac');

                if (startVal) {
                    endInput.min = startVal;
                    if (endInput.value && endInput.value < startVal) {
                        endInput.value = startVal;
                    }
                }

                const restDay = reqData.rest_day || (emp ? emp.rest_day : null) || null;
                const calculated = this.calculateVacationDays(startVal, endInput.value, restDay);
                daysInput.value = calculated;

                if (calculated <= 0) {
                    warnBox.style.display = 'block';
                    warnBox.textContent = 'El rango de fechas debe tener al menos un día laborable.';
                    saveBtn.disabled = true;
                } else {
                    warnBox.style.display = 'none';
                    saveBtn.disabled = false;
                }
            };

            document.getElementById('v-edit-start').addEventListener('change', recalculateEditDays);
            document.getElementById('v-edit-start').addEventListener('input', recalculateEditDays);
            document.getElementById('v-edit-end').addEventListener('change', recalculateEditDays);
            document.getElementById('v-edit-end').addEventListener('input', recalculateEditDays);

            document.getElementById('btn-save-edit-vac').addEventListener('click', async () => {
                const start_date = document.getElementById('v-edit-start').value;
                const end_date = document.getElementById('v-edit-end').value;
                const days_requested = parseInt(document.getElementById('v-edit-days').value);
                const vacation_pay_percentage = document.getElementById('v-edit-pct').value;
                const status = document.getElementById('v-edit-status').value;
                const notes = document.getElementById('v-edit-notes').value.trim();

                if (end_date < start_date) {
                    Toast.warning('La fecha de fin no puede ser inferior a la de inicio.');
                    return;
                }

                if (days_requested <= 0) {
                    Toast.warning('Debe haber al menos un día hábil en el rango.');
                    return;
                }

                try {
                    await API.put(`/vacations/requests/${requestId}`, {
                        start_date, end_date, days_requested, vacation_pay_percentage, status, notes
                    });
                    Toast.success('Periodo vacacional corregido exitosamente.');
                    Modal.close();
                    await this.loadBalanceData();
                    this.infinityTable.resetAndLoad();
                } catch (e) {
                    Toast.danger(e.message || 'Error al corregir periodo vacacional.');
                }
            });
        } catch (e) {
            Toast.danger('Error al consultar datos de la solicitud.');
        }
    },

    async updateStatus(id, status) {
        if (!Auth.isAdmin()) {
            Toast.warning('Solo los administradores pueden cambiar el estatus de las solicitudes.');
            return;
        }

        try {
            await API.put(`/vacations/requests/${id}/status`, { status });
            Toast.success(`Solicitud de vacaciones actualizada.`);
            await this.loadBalanceData();
            this.infinityTable.resetAndLoad();
        } catch (e) {
            Toast.danger(e.message || 'Error al actualizar estatus.');
        }
    }
};

window.VacationsModule = VacationsModule;
