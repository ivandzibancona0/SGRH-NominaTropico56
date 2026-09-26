// Users & Roles Management Module
const UsersModule = {
    users: [],

    async render(container) {
        if (!Auth.isAdmin()) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 3rem 1.5rem;">
                    <div style="width: 48px; height: 48px; margin: 0 auto 1rem; color: var(--color-danger);">${Icons.alert || Icons.x}</div>
                    <h3>Acceso Restringido</h3>
                    <p style="color: var(--color-muted); max-width: 400px; margin: 0.5rem auto 1.5rem;">
                        El módulo de gestión de usuarios requiere privilegios de <strong>Administrador</strong>.
                    </p>
                    <button class="btn btn-secondary" onclick="App.navigate('dashboard')">Volver al Panel</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="view-header">
                <div class="view-header-title">
                    <h2>Gestión de Usuarios del Sistema</h2>
                    <p style="color: var(--color-muted); font-size: 0.9rem;">
                        Control de accesos y asignación de roles (Administradores y Estándar).
                    </p>
                </div>
                <div class="view-actions">
                    <button class="btn btn-primary" id="btn-add-user">
                        <span style="width: 18px; height: 18px;">${Icons.plus}</span>
                        <span>Crear Usuario</span>
                    </button>
                </div>
            </div>

            <!-- Users Table Card -->
            <div class="card">
                <div class="card-header">
                    <h3><span style="width: 20px; height: 20px;">${Icons.users}</span> Cuentas de Acceso</h3>
                    <span class="badge badge-primary" id="user-count-badge">0 usuarios</span>
                </div>

                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Usuario / Nombre Completo</th>
                                <th>Correo Electrónico</th>
                                <th>Rol del Sistema</th>
                                <th>Estatus</th>
                                <th>Fecha de Alta</th>
                                <th style="text-align: right;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="users-tbody">
                            <tr><td colspan="6" class="table-empty-state"><div class="spinner"></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btn-add-user').addEventListener('click', () => this.openUserModal());
        await this.loadUsers();
    },

    async loadUsers() {
        try {
            const res = await API.get('/users');
            this.users = res.data || [];
            this.renderTable();
        } catch (e) {
            Toast.danger('Error al consultar usuarios.');
        }
    },

    renderTable() {
        const tbody = document.getElementById('users-tbody');
        document.getElementById('user-count-badge').textContent = `${this.users.length} usuarios`;

        if (this.users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="table-empty-state"><p>No se encontraron usuarios.</p></td></tr>`;
            return;
        }

        tbody.innerHTML = this.users.map(u => {
            const isAdmin = u.role === 'admin';
            const isActive = !!u.active;

            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="user-avatar-initial" style="background: ${isAdmin ? 'var(--color-primary)' : 'var(--color-accent)'};">
                                ${u.full_name[0]}
                            </div>
                            <div>
                                <strong>${u.full_name}</strong>
                                <div style="font-size: 0.75rem; color: var(--color-muted); font-family: monospace;">@${u.username}</div>
                            </div>
                        </div>
                    </td>
                    <td>${u.email}</td>
                    <td>
                        <span class="badge ${isAdmin ? 'badge-primary' : 'badge-info'}">
                            ${isAdmin ? 'Administrador' : 'Estándar'}
                        </span>
                    </td>
                    <td>
                        <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}">
                            <span class="badge-dot"></span>
                            ${isActive ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td style="font-size: 0.82rem; color: var(--color-muted);">${u.created_at ? u.created_at.substring(0, 10) : '-'}</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button class="btn btn-secondary btn-sm btn-icon-only" onclick="UsersModule.openUserModal(${u.id})" title="Editar Usuario">
                            <span style="width: 15px; height: 15px;">${Icons.edit}</span>
                        </button>
                        ${u.id !== Auth.currentUser?.id ? `
                            <button class="btn btn-outline-danger btn-sm btn-icon-only" onclick="UsersModule.deleteUser(${u.id})" title="Eliminar Usuario">
                                <span style="width: 15px; height: 15px;">${Icons.trash}</span>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },

    openUserModal(id = null) {
        const user = id ? this.users.find(u => u.id === id) : null;
        const title = user ? `Editar Usuario: ${user.username}` : 'Crear Nuevo Usuario';

        const content = `
            <form id="user-form">
                <div class="form-row form-row-2">
                    <div class="form-group">
                        <label>Nombre de Usuario <span class="required">*</span></label>
                        <input type="text" id="u-username" class="form-control" placeholder="ej. jhernandez" value="${user ? user.username : ''}" ${user ? 'disabled' : ''} required>
                    </div>
                    <div class="form-group">
                        <label>Rol del Sistema <span class="required">*</span></label>
                        <select id="u-role" class="form-control" required>
                            <option value="standard" ${user && user.role === 'standard' ? 'selected' : ''}>Estándar (Operativo / Consultas)</option>
                            <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Administrador (Acceso Total)</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label>Nombre Completo <span class="required">*</span></label>
                    <input type="text" id="u-fullname" class="form-control" placeholder="Ej. Juan Carlos Hernández" value="${user ? user.full_name : ''}" required>
                </div>

                <div class="form-group">
                    <label>Correo Electrónico <span class="required">*</span></label>
                    <input type="email" id="u-email" class="form-control" placeholder="usuario@tropico56.com" value="${user ? user.email : ''}" required>
                </div>

                <div class="form-group">
                    <label>${user ? 'Nueva Contraseña (Dejar en blanco para no modificar)' : 'Contraseña de Acceso'} <span class="${user ? '' : 'required'}">*</span></label>
                    <input type="password" id="u-password" class="form-control" placeholder="${user ? '••••••••' : 'Mínimo 6 caracteres'}" ${user ? '' : 'required'}>
                </div>

                ${user ? `
                    <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem;">
                        <input type="checkbox" id="u-active" ${user.active ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--color-primary);">
                        <label for="u-active" style="margin-bottom: 0; font-weight: 600; cursor: pointer;">Usuario Activo (Permitir acceso)</label>
                    </div>
                ` : ''}
            </form>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-user">${user ? 'Guardar Cambios' : 'Crear Usuario'}</button>
        `;

        Modal.open({ title, content, footer });

        document.getElementById('btn-save-user').addEventListener('click', async () => {
            const payload = {
                username: document.getElementById('u-username')?.value.trim(),
                full_name: document.getElementById('u-fullname')?.value.trim(),
                email: document.getElementById('u-email')?.value.trim(),
                role: document.getElementById('u-role')?.value,
                password: document.getElementById('u-password')?.value.trim()
            };

            if (user) {
                payload.active = document.getElementById('u-active')?.checked ? 1 : 0;
            }

            if (!payload.full_name || !payload.email || (!user && (!payload.username || !payload.password))) {
                Toast.warning('Completa todos los campos obligatorios.');
                return;
            }

            try {
                if (user) {
                    await API.put(`/users/${user.id}`, payload);
                    Toast.success('Usuario actualizado correctamente.');
                } else {
                    await API.post('/users', payload);
                    Toast.success('Usuario creado exitosamente.');
                }
                Modal.close();
                await this.loadUsers();
            } catch (err) {
                Toast.danger(err.message || 'Error al guardar usuario.');
            }
        });
    },

    async deleteUser(id) {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
        try {
            await API.delete(`/users/${id}`);
            Toast.success('Usuario eliminado.');
            await this.loadUsers();
        } catch (e) {
            Toast.danger(e.message || 'No se pudo eliminar el usuario.');
        }
    }
};

window.UsersModule = UsersModule;
