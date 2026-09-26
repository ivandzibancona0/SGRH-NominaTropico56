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
                        ${row.status === 'pending' ? `
                            <button class="btn btn-secondary btn-sm" onclick="VacationsModule.updateStatus(${row.id}, 'approved')" title="Aprobar">
                                <span style="width: 14px; height: 14px;">${Icons.check}</span>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="VacationsModule.updateStatus(${row.id}, 'rejected')" title="Rechazar">
                                <span style="width: 14px; height: 14px;">${Icons.x}</span>
                            </button>
                        ` : '<span style="font-size: 0.75rem; color: var(--color-muted);">Procesado</span>'}
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
    // MODAL REGISTRO DE PERIODO VACACIONAL
    // -------------------------------------------------------------
    openRequestModal(empId = null) {
        const eligibleEmployees = this.employeesBalance.filter(e => e.is_eligible && e.remaining_days > 0);

        if (eligibleEmployees.length === 0) {
            Toast.warning('No hay colaboradores con saldo de vacaciones disponible en este momento.');
            return;
        }

        const selectedEmp = empId ? this.employeesBalance.find(e => e.id === empId) : eligibleEmployees[0];

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
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Fecha de Inicio <span class="required">*</span></label>
                        <input type="date" id="v-req-start" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Fecha de Término <span class="required">*</span></label>
                        <input type="date" id="v-req-end" class="form-control" value="${new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0]}" required>
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Días Solicitados <span class="required">*</span></label>
                        <input type="number" min="1" max="${selectedEmp ? selectedEmp.remaining_days : 30}" id="v-req-days" class="form-control" value="${Math.min(6, selectedEmp ? selectedEmp.remaining_days : 6)}" required>
                    </div>
                    <div class="form-group">
                        <label>% Prima Vacacional Aplicable</label>
                        <input type="number" step="1" id="v-req-pct" class="form-control" value="25" placeholder="25%">
                    </div>
                </div>

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

        // Update live balance info when employee select changes
        document.getElementById('v-req-emp').addEventListener('change', (e) => {
            const emp = this.employeesBalance.find(em => em.id === parseInt(e.target.value));
            if (emp) {
                document.getElementById('v-earned-val').textContent = emp.earned_days;
                document.getElementById('v-taken-val').textContent = emp.taken_days;
                document.getElementById('v-remaining-val').textContent = emp.remaining_days;
                document.getElementById('v-req-days').max = emp.remaining_days;
                if (parseInt(document.getElementById('v-req-days').value) > emp.remaining_days) {
                    document.getElementById('v-req-days').value = emp.remaining_days;
                }
            }
        });

        document.getElementById('btn-save-vac-req').addEventListener('click', async () => {
            const employee_id = document.getElementById('v-req-emp').value;
            const start_date = document.getElementById('v-req-start').value;
            const end_date = document.getElementById('v-req-end').value;
            const days_requested = document.getElementById('v-req-days').value;
            const vacation_pay_percentage = document.getElementById('v-req-pct').value;
            const notes = document.getElementById('v-req-notes').value.trim();

            if (!employee_id || !start_date || !end_date || !days_requested) {
                Toast.warning('Completa todos los campos obligatorios.');
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

    async updateStatus(id, status) {
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
