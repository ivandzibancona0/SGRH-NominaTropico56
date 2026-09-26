// Departments and Positions Module
const DepartmentsModule = {
    departments: [],
    positions: [],

    async render(container) {
        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Departamentos y Puestos</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">Estructura organizativa, áreas operativas y tabulador de salarios de Trópico 56.</p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-secondary" id="btn-add-dept">
                        <span style="width: 16px; height: 16px;">${Icons.plus}</span>
                        <span>Nuevo Departamento</span>
                    </button>
                    <button class="btn btn-primary" id="btn-add-pos">
                        <span style="width: 16px; height: 16px;">${Icons.plus}</span>
                        <span>Nuevo Puesto</span>
                    </button>
                </div>
            </div>

            <!-- Two Columns for Departments and Positions -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem;">
                
                <!-- DEPARTAMENTOS CARD -->
                <div class="card">
                    <div class="card-header">
                        <h3><span style="width: 20px; height: 20px;">${Icons.departments}</span> Departamentos</h3>
                        <span class="badge badge-primary" id="dept-badge-count">0 áreas</span>
                    </div>
                    <div class="table-responsive" style="max-height: 480px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Puestos / Empleados</th>
                                    <th style="text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="depts-tbody">
                                <tr><td colspan="3" class="table-empty-state"><div class="spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- PUESTOS CARD -->
                <div class="card">
                    <div class="card-header">
                        <h3><span style="width: 20px; height: 20px;">${Icons.users}</span> Puestos y Salarios Base</h3>
                        <span class="badge badge-accent" id="pos-badge-count">0 puestos</span>
                    </div>
                    <div class="table-responsive" style="max-height: 480px;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Puesto</th>
                                    <th>Departamento</th>
                                    <th>Salario Diario Base</th>
                                    <th style="text-align: right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="positions-tbody">
                                <tr><td colspan="4" class="table-empty-state"><div class="spinner"></div></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-add-dept').addEventListener('click', () => this.openDeptModal());
        document.getElementById('btn-add-pos').addEventListener('click', () => this.openPosModal());

        await this.loadAll();
    },

    async loadAll() {
        try {
            const [dRes, pRes] = await Promise.all([
                API.get('/departments'),
                API.get('/positions')
            ]);

            this.departments = dRes.data || [];
            this.positions = pRes.data || [];

            this.renderDepartmentsTable();
            this.renderPositionsTable();
        } catch (error) {
            Toast.danger('Error al cargar datos de departamentos y puestos.');
        }
    },

    renderDepartmentsTable() {
        const tbody = document.getElementById('depts-tbody');
        document.getElementById('dept-badge-count').textContent = `${this.departments.length} áreas`;

        if (this.departments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="table-empty-state"><p>No hay departamentos registrados.</p></td></tr>`;
            return;
        }

        tbody.innerHTML = this.departments.map(d => `
            <tr>
                <td>
                    <strong>${d.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--color-muted);">${d.description || 'Sin descripción'}</div>
                </td>
                <td>
                    <span class="badge badge-info">${d.positions_count || 0} puestos</span>
                    <span class="badge badge-primary">${d.employees_count || 0} emp.</span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm btn-icon-only" onclick="DepartmentsModule.openDeptModal(${d.id})" title="Editar">
                        <span style="width: 15px; height: 15px;">${Icons.edit}</span>
                    </button>
                    <button class="btn btn-outline-danger btn-sm btn-icon-only" onclick="DepartmentsModule.deleteDept(${d.id})" title="Eliminar">
                        <span style="width: 15px; height: 15px;">${Icons.trash}</span>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderPositionsTable() {
        const tbody = document.getElementById('positions-tbody');
        document.getElementById('pos-badge-count').textContent = `${this.positions.length} puestos`;

        if (this.positions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="table-empty-state"><p>No hay puestos registrados.</p></td></tr>`;
            return;
        }

        tbody.innerHTML = this.positions.map(p => `
            <tr>
                <td>
                    <strong>${p.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--color-muted);">${p.description || ''}</div>
                </td>
                <td><span class="badge badge-primary">${p.department_name}</span></td>
                <td><strong>$${parseFloat(p.base_daily_salary || 0).toFixed(2)} MXN</strong></td>
                <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm btn-icon-only" onclick="DepartmentsModule.openPosModal(${p.id})" title="Editar">
                        <span style="width: 15px; height: 15px;">${Icons.edit}</span>
                    </button>
                    <button class="btn btn-outline-danger btn-sm btn-icon-only" onclick="DepartmentsModule.deletePos(${p.id})" title="Eliminar">
                        <span style="width: 15px; height: 15px;">${Icons.trash}</span>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    openDeptModal(id = null) {
        const dept = id ? this.departments.find(d => d.id === id) : null;
        const title = dept ? 'Editar Departamento' : 'Nuevo Departamento';

        const content = `
            <form id="dept-form">
                <div class="form-group">
                    <label>Nombre del Departamento <span class="required">*</span></label>
                    <input type="text" id="dept-name" class="form-control" placeholder="Ej. Cocina, Barra, Servicio" value="${dept ? dept.name : ''}" required>
                </div>
                <div class="form-group">
                    <label>Descripción del Área</label>
                    <textarea id="dept-desc" class="form-control" rows="3" placeholder="Funciones y responsabilidades generales">${dept ? (dept.description || '') : ''}</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-dept">${dept ? 'Guardar Cambios' : 'Crear Departamento'}</button>
        `;

        Modal.open({ title, content, footer });

        document.getElementById('btn-save-dept').addEventListener('click', async () => {
            const name = document.getElementById('dept-name').value.trim();
            const description = document.getElementById('dept-desc').value.trim();

            if (!name) {
                Toast.warning('El nombre del departamento es obligatorio.');
                return;
            }

            try {
                if (dept) {
                    await API.put(`/departments/${dept.id}`, { name, description });
                    Toast.success('Departamento actualizado correctamente.');
                } else {
                    await API.post('/departments', { name, description });
                    Toast.success('Departamento creado con éxito.');
                }
                Modal.close();
                await this.loadAll();
            } catch (err) {
                Toast.danger(err.message || 'Error al guardar departamento.');
            }
        });
    },

    openPosModal(id = null) {
        const pos = id ? this.positions.find(p => p.id === id) : null;
        const title = pos ? 'Editar Puesto' : 'Nuevo Puesto';

        if (this.departments.length === 0) {
            Toast.warning('Primero debes crear al menos un departamento.');
            return;
        }

        const deptOptions = this.departments.map(d => `
            <option value="${d.id}" ${pos && pos.department_id === d.id ? 'selected' : ''}>${d.name}</option>
        `).join('');

        const content = `
            <form id="pos-form">
                <div class="form-group">
                    <label>Departamento <span class="required">*</span></label>
                    <select id="pos-dept" class="form-control" required>
                        ${deptOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Nombre del Puesto <span class="required">*</span></label>
                    <input type="text" id="pos-name" class="form-control" placeholder="Ej. Chef Ejecutivo, Bartender, Mesero" value="${pos ? pos.name : ''}" required>
                </div>
                <div class="form-group">
                    <label>Salario Diario Base (MXN) <span class="required">*</span></label>
                    <input type="number" step="0.01" id="pos-salary" class="form-control" placeholder="0.00" value="${pos ? pos.base_daily_salary : ''}" required>
                </div>
                <div class="form-group">
                    <label>Descripción de Funciones</label>
                    <textarea id="pos-desc" class="form-control" rows="2" placeholder="Responsabilidades clave">${pos ? (pos.description || '') : ''}</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-pos">${pos ? 'Guardar Cambios' : 'Crear Puesto'}</button>
        `;

        Modal.open({ title, content, footer });

        document.getElementById('btn-save-pos').addEventListener('click', async () => {
            const department_id = document.getElementById('pos-dept').value;
            const name = document.getElementById('pos-name').value.trim();
            const base_daily_salary = document.getElementById('pos-salary').value;
            const description = document.getElementById('pos-desc').value.trim();

            if (!name || !base_daily_salary) {
                Toast.warning('Nombre del puesto y salario diario son obligatorios.');
                return;
            }

            try {
                if (pos) {
                    await API.put(`/positions/${pos.id}`, { department_id, name, base_daily_salary, description });
                    Toast.success('Puesto actualizado correctamente.');
                } else {
                    await API.post('/positions', { department_id, name, base_daily_salary, description });
                    Toast.success('Puesto creado con éxito.');
                }
                Modal.close();
                await this.loadAll();
            } catch (err) {
                Toast.danger(err.message || 'Error al guardar puesto.');
            }
        });
    },

    async deleteDept(id) {
        if (!confirm('¿Estás seguro de eliminar este departamento?')) return;
        try {
            await API.delete(`/departments/${id}`);
            Toast.success('Departamento eliminado.');
            await this.loadAll();
        } catch (err) {
            Toast.danger(err.message || 'No se pudo eliminar el departamento.');
        }
    },

    async deletePos(id) {
        if (!confirm('¿Estás seguro de eliminar este puesto?')) return;
        try {
            await API.delete(`/positions/${id}`);
            Toast.success('Puesto eliminado.');
            await this.loadAll();
        } catch (err) {
            Toast.danger(err.message || 'No se pudo eliminar el puesto.');
        }
    }
};

window.DepartmentsModule = DepartmentsModule;
