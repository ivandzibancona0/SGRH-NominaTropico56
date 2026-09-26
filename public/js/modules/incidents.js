// Incidents Module with Infinity Scroll & Debt Installments
const IncidentsModule = {
    infinityTable: null,

    async render(container) {
        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Incidencias Laborales (Cargos / Mermas)</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">
                        Registro de errores humanos, roturas o faltantes a descontar en nómina por parcialidades.
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btn-add-incident">
                        <span style="width: 18px; height: 18px;">${Icons.plus}</span>
                        <span>Registrar Incidencia</span>
                    </button>
                </div>
            </div>

            <!-- Incidents KPI Grid -->
            <div class="kpi-grid" id="inc-kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon primary">${Icons.incidents}</div>
                    <div class="kpi-content">
                        <h4>Saldo Total Pendiente</h4>
                        <div class="kpi-value" id="inc-kpi-pending" style="color: var(--color-danger);">--</div>
                        <div class="kpi-subtext" id="inc-kpi-count">Por descontar en nómina</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon success">${Icons.dollar}</div>
                    <div class="kpi-content">
                        <h4>Total Recuperado</h4>
                        <div class="kpi-value" id="inc-kpi-collected">--</div>
                        <div class="kpi-subtext">Descontado exitosamente</div>
                    </div>
                </div>

                <div class="kpi-card">
                    <div class="kpi-icon accent">${Icons.calculator}</div>
                    <div class="kpi-content">
                        <h4>Total Histórico</h4>
                        <div class="kpi-value" id="inc-kpi-total">--</div>
                        <div class="kpi-subtext">Total de mermas registradas</div>
                    </div>
                </div>
            </div>

            <!-- Filter Bar -->
            <div class="filter-bar">
                <div class="filter-actions" style="flex: 1;">
                    <select id="inc-filter-status" class="form-control" style="width: 190px;">
                        <option value="">Todos los Estados</option>
                        <option value="pending">Pendientes de Cobro</option>
                        <option value="in_payroll">En Descuento de Nómina</option>
                        <option value="paid">Liquidadas / Pagadas</option>
                        <option value="cancelled">Canceladas</option>
                    </select>

                    <select id="inc-filter-type" class="form-control" style="width: 210px;">
                        <option value="">Todos los Tipos</option>
                        <option value="Cristalería / Loza Rota">Cristalería / Loza Rota</option>
                        <option value="Descuadre / Faltante en Caja">Descuadre / Faltante en Caja</option>
                        <option value="Comanda Errónea">Comanda Errónea</option>
                        <option value="Daño a Equipo / Mobiliario">Daño a Equipo / Mobiliario</option>
                        <option value="Merma No Justificada">Merma No Justificada</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
            </div>

            <!-- Table with Infinity Scroll -->
            <div class="table-container" id="incidents-table-container">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Colaborador</th>
                                <th>Tipo de Incidencia</th>
                                <th>Descripción</th>
                                <th>Monto Total</th>
                                <th>Cuotas / Descuento</th>
                                <th>Saldo Pendiente</th>
                                <th>Estatus</th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="incidents-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-incident').addEventListener('click', () => this.openIncidentModal());
        document.getElementById('inc-filter-status').addEventListener('change', () => this.infinityTable.resetAndLoad());
        document.getElementById('inc-filter-type').addEventListener('change', () => this.infinityTable.resetAndLoad());

        await this.loadStats();
        this.initInfinityScroll();
    },

    async loadStats() {
        try {
            const res = await API.get('/incidents/stats');
            if (res.success) {
                const s = res.data;
                document.getElementById('inc-kpi-pending').textContent = `$${parseFloat(s.total_pending || 0).toFixed(2)}`;
                document.getElementById('inc-kpi-count').textContent = `${s.active_incidents || 0} incidencias activas`;
                document.getElementById('inc-kpi-collected').textContent = `$${parseFloat(s.total_collected || 0).toFixed(2)}`;
                document.getElementById('inc-kpi-total').textContent = `$${parseFloat(s.total_charged || 0).toFixed(2)}`;
            }
        } catch (e) {
            console.error('Error al cargar estadísticas de incidencias:', e);
        }
    },

    initInfinityScroll() {
        const container = document.getElementById('incidents-table-container');
        const tbody = document.getElementById('incidents-tbody');

        this.infinityTable = new InfinityScrollTable({
            containerElement: container,
            tbodyElement: tbody,
            emptyMessage: 'No hay incidencias registradas con los filtros seleccionados.',
            fetchDataFunction: async (page, limit) => {
                const status = document.getElementById('inc-filter-status')?.value || '';
                const type = document.getElementById('inc-filter-type')?.value || '';

                return await API.get('/incidents', {
                    page,
                    limit,
                    status,
                    type
                });
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
                    <td style="font-size: 0.82rem; max-width: 220px; color: var(--color-dark);">${row.description}</td>
                    <td><strong>$${parseFloat(row.total_amount).toFixed(2)}</strong></td>
                    <td>
                        <span style="font-size: 0.82rem;">${row.installments} cuota(s) de $${parseFloat(row.installment_amount).toFixed(2)}</span>
                    </td>
                    <td>
                        <strong style="color: ${parseFloat(row.pending_amount) > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; font-size: 0.95rem;">
                            $${parseFloat(row.pending_amount).toFixed(2)}
                        </strong>
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">${statusLabel}</span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; flex-direction: column; align-items: flex-end; gap: 0.35rem;">
                            ${parseFloat(row.pending_amount) > 0 && row.status !== 'paid' ? `
                                <button class="btn btn-secondary btn-sm" onclick="IncidentsModule.markPaid(${row.id})" title="Marcar como Liquidado" style="padding: 0.2rem 0.55rem; font-size: 0.75rem; width: 100%; justify-content: center; height: 26px;">
                                    Liquidar
                                </button>
                            ` : ''}
                            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                                <button class="btn btn-secondary btn-sm btn-icon-only" onclick="IncidentsModule.openEditIncidentModal(${row.id})" title="Editar Incidencia / Estatus">
                                    <span style="width: 14px; height: 14px;">${Icons.edit}</span>
                                </button>
                                <button class="btn btn-outline-danger btn-sm btn-icon-only" onclick="IncidentsModule.deleteIncident(${row.id})" title="Eliminar Incidencia">
                                    <span style="width: 14px; height: 14px;">${Icons.trash}</span>
                                </button>
                            </div>
                        </div>
                    </td>
                `;
            }
        });

        this.infinityTable.loadNextPage();
    },

    async openIncidentModal() {
        const empRes = await API.get('/employees', { limit: 100 });
        const employees = (empRes.data || []).filter(e => e.status === 'active');

        // Check system payment period setting for helpful wording
        let periodWord = 'periodo de nómina';
        try {
            const setRes = await API.get('/system/settings');
            const p = setRes.settings?.default_payment_period;
            if (p === 'semanal') periodWord = 'semana';
            else if (p === 'diario') periodWord = 'día / jornada';
            else if (p === 'quincenal') periodWord = 'quincena';
            else if (p === 'catorcenal') periodWord = 'catorcena';
        } catch (e) {}

        const content = `
            <form id="incident-form">
                <div class="form-group">
                    <label>Colaborador Responsable <span class="required">*</span></label>
                    <select id="inc-emp" class="form-control" required>
                        <option value="">Selecciona Colaborador</option>
                        ${employees.map(e => `<option value="${e.id}">${e.first_name} ${e.last_name} (${e.position_name})</option>`).join('')}
                    </select>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Fecha del Incidente <span class="required">*</span></label>
                        <input type="date" id="inc-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Tipo de Incidencia <span class="required">*</span></label>
                        <select id="inc-type" class="form-control" required>
                            <option value="Cristalería / Loza Rota">Cristalería / Loza Rota</option>
                            <option value="Descuadre / Faltante en Caja">Descuadre / Faltante en Caja</option>
                            <option value="Comanda Errónea">Comanda Errónea</option>
                            <option value="Daño a Equipo / Mobiliario">Daño a Equipo / Mobiliario</option>
                            <option value="Merma No Justificada">Merma No Justificada</option>
                            <option value="Otro">Otro Cargo</option>
                        </select>
                    </div>
                </div>

                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Monto Total del Cargo ($ MXN) <span class="required">*</span></label>
                        <input type="number" step="0.01" id="inc-total" class="form-control" placeholder="0.00" required>
                    </div>
                    <div class="form-group">
                        <label>Número de Cuotas / Periodos de Nómina <span class="required">*</span></label>
                        <select id="inc-installments" class="form-control">
                            <option value="1">1 cuota (Descontar total en el siguiente periodo)</option>
                            <option value="2">2 cuotas diferidas</option>
                            <option value="3">3 cuotas diferidas</option>
                            <option value="4">4 cuotas diferidas</option>
                            <option value="6">6 cuotas diferidas</option>
                        </select>
                    </div>
                </div>

                <div style="background: var(--color-bg); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 1.15rem; color: var(--color-dark);" id="inc-preview-calc">
                    Descuento calculado: <strong>$0.00</strong> por cada <strong>${periodWord}</strong>
                </div>

                <div class="form-group">
                    <label>Descripción / Motivo del Cargo <span class="required">*</span></label>
                    <textarea id="inc-desc" class="form-control" rows="2" placeholder="Describe qué ocurrió, artículos rotos o motivo del cobro..." required></textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-incident">Registrar Incidencia</button>
        `;

        Modal.open({
            title: 'Registrar Nueva Incidencia Laboral / Merma',
            content,
            size: 'lg',
            footer
        });

        const updateTotalPreview = () => {
            const total = parseFloat(document.getElementById('inc-total').value) || 0;
            const inst = parseInt(document.getElementById('inc-installments').value) || 1;
            const perInst = (total / inst).toFixed(2);
            document.getElementById('inc-preview-calc').innerHTML = `
                Descuento calculado: <strong style="color: var(--color-primary); font-size: 1rem;">$${perInst} MXN</strong> por cada <strong>${periodWord}</strong> (${inst} cuota(s)).
            `;
        };

        document.getElementById('inc-total').addEventListener('input', updateTotalPreview);
        document.getElementById('inc-installments').addEventListener('change', updateTotalPreview);

        document.getElementById('btn-save-incident').addEventListener('click', async () => {
            const employee_id = document.getElementById('inc-emp').value;
            const date = document.getElementById('inc-date').value;
            const type = document.getElementById('inc-type').value;
            const description = document.getElementById('inc-desc').value.trim();
            const total_amount = document.getElementById('inc-total').value;
            const installments = document.getElementById('inc-installments').value;

            if (!employee_id || !date || !type || !description || !total_amount) {
                Toast.warning('Completa todos los campos obligatorios.');
                return;
            }

            try {
                await API.post('/incidents', {
                    employee_id, date, type, description, total_amount, installments
                });
                Toast.success('Incidencia laboral registrada correctamente.');
                Modal.close();
                await this.loadStats();
                this.infinityTable.resetAndLoad();
            } catch (err) {
                Toast.danger(err.message || 'Error al guardar incidencia.');
            }
        });
    },

    async openEditIncidentModal(id) {
        try {
            const res = await API.get(`/incidents/${id}`);
            const inc = res.data;

            const content = `
                <form id="edit-incident-form">
                    <div style="background: var(--color-bg); padding: 0.85rem 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
                        <div style="font-size: 0.8rem; color: var(--color-muted);">COLABORADOR RESPONSABLE</div>
                        <strong style="font-size: 1.05rem; color: var(--color-dark);">${inc.first_name} ${inc.last_name}</strong>
                        <div style="font-size: 0.82rem; color: var(--color-muted);">${inc.code} · ${inc.position_name} (${inc.department_name})</div>
                    </div>

                    <div class="form-row form-row-2">
                        <div class="form-group">
                            <label>Fecha de Incidencia <span class="required">*</span></label>
                            <input type="date" id="edit-inc-date" class="form-control" value="${inc.date}" required>
                        </div>
                        <div class="form-group">
                            <label>Tipo de Incidencia <span class="required">*</span></label>
                            <select id="edit-inc-type" class="form-control" required>
                                <option value="Cristalería / Loza Rota" ${inc.type === 'Cristalería / Loza Rota' ? 'selected' : ''}>Cristalería / Loza Rota</option>
                                <option value="Descuadre / Faltante en Caja" ${inc.type === 'Descuadre / Faltante en Caja' ? 'selected' : ''}>Descuadre / Faltante en Caja</option>
                                <option value="Comanda Errónea" ${inc.type === 'Comanda Errónea' ? 'selected' : ''}>Comanda Errónea</option>
                                <option value="Daño a Equipo / Mobiliario" ${inc.type === 'Daño a Equipo / Mobiliario' ? 'selected' : ''}>Daño a Equipo / Mobiliario</option>
                                <option value="Merma No Justificada" ${inc.type === 'Merma No Justificada' ? 'selected' : ''}>Merma No Justificada</option>
                                <option value="Otro" ${inc.type === 'Otro' ? 'selected' : ''}>Otro Cargo</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row form-row-3">
                        <div class="form-group">
                            <label>Monto Total ($ MXN) <span class="required">*</span></label>
                            <input type="number" step="0.01" id="edit-inc-total" class="form-control" value="${inc.total_amount}" required>
                        </div>
                        <div class="form-group">
                            <label>Saldo Pendiente ($ MXN) <span class="required">*</span></label>
                            <input type="number" step="0.01" id="edit-inc-pending" class="form-control" value="${inc.pending_amount}" required>
                        </div>
                        <div class="form-group">
                            <label>Estatus de la Incidencia <span class="required">*</span></label>
                            <select id="edit-inc-status" class="form-control" required>
                                <option value="pending" ${inc.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                                <option value="in_payroll" ${inc.status === 'in_payroll' ? 'selected' : ''}>En Nómina</option>
                                <option value="paid" ${inc.status === 'paid' ? 'selected' : ''}>Liquidado / Pagado</option>
                                <option value="cancelled" ${inc.status === 'cancelled' ? 'selected' : ''}>Cancelado / Condonado</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Descripción / Motivo del Cargo <span class="required">*</span></label>
                        <textarea id="edit-inc-desc" class="form-control" rows="2" required>${inc.description || ''}</textarea>
                    </div>
                </form>
            `;

            const footer = `
                <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
                <button class="btn btn-primary" id="btn-update-incident">Actualizar Incidencia</button>
            `;

            Modal.open({
                title: 'Modificar Incidencia / Cambiar Estatus',
                content,
                size: 'lg',
                footer
            });

            // If status is changed to 'paid', auto-set pending amount to 0
            document.getElementById('edit-inc-status').addEventListener('change', (e) => {
                const status = e.target.value;
                const pendingInput = document.getElementById('edit-inc-pending');
                if (status === 'paid' || status === 'cancelled') {
                    pendingInput.value = '0.00';
                }
            });

            document.getElementById('btn-update-incident').addEventListener('click', async () => {
                const payload = {
                    date: document.getElementById('edit-inc-date').value,
                    type: document.getElementById('edit-inc-type').value,
                    description: document.getElementById('edit-inc-desc').value.trim(),
                    total_amount: document.getElementById('edit-inc-total').value,
                    pending_amount: document.getElementById('edit-inc-pending').value,
                    status: document.getElementById('edit-inc-status').value
                };

                if (!payload.date || !payload.type || !payload.description || payload.total_amount === '' || payload.pending_amount === '') {
                    Toast.warning('Completa todos los campos obligatorios.');
                    return;
                }

                try {
                    await API.put(`/incidents/${id}`, payload);
                    Toast.success('Incidencia y estatus actualizados correctamente.');
                    Modal.close();
                    await this.loadStats();
                    this.infinityTable.resetAndLoad();
                } catch (err) {
                    Toast.danger(err.message || 'Error al actualizar incidencia.');
                }
            });
        } catch (e) {
            Toast.danger('Error al consultar datos de la incidencia.');
        }
    },

    async markPaid(id) {
        if (!confirm('¿Deseas marcar esta incidencia como totalmente pagada / liquidada?')) return;
        try {
            await API.put(`/incidents/${id}/status`, { status: 'paid', pending_amount: 0 });
            Toast.success('Incidencia liquidada.');
            await this.loadStats();
            this.infinityTable.resetAndLoad();
        } catch (e) {
            Toast.danger(e.message || 'No se pudo liquidar la incidencia.');
        }
    },

    async deleteIncident(id) {
        if (!confirm('¿Estás seguro de eliminar esta incidencia? Esta acción no se puede deshacer.')) return;
        try {
            await API.delete(`/incidents/${id}`);
            Toast.success('Incidencia eliminada exitosamente.');
            await this.loadStats();
            this.infinityTable.resetAndLoad();
        } catch (e) {
            Toast.danger(e.message || 'No se pudo eliminar la incidencia.');
        }
    }
};

window.IncidentsModule = IncidentsModule;
