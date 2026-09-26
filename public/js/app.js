// ==========================================================
// MAIN APPLICATION CONTROLLER & ROUTER
// Trópico 56 SGRH (Mobile First)
// ==========================================================

const App = {
    currentRoute: 'dashboard',

    init() {
        this.bindEvents();

        if (Auth.isAuthenticated()) {
            this.showApp();
        } else {
            this.showAuth();
        }
    },

    bindEvents() {
        // Login form submit
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('login-username').value.trim();
                const password = document.getElementById('login-password').value;
                const btn = document.getElementById('btn-login-submit');

                try {
                    btn.disabled = true;
                    btn.textContent = 'Iniciando sesión...';
                    await Auth.login(username, password);
                    Toast.success(`¡Bienvenido de nuevo!`);
                    this.showApp();
                } catch (err) {
                    Toast.danger(err.message || 'Credenciales inválidas.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Iniciar Sesión';
                }
            });
        }

        // Punch clock topbar button
        const topbarPunchBtn = document.getElementById('topbar-btn-punch');
        if (topbarPunchBtn) topbarPunchBtn.addEventListener('click', () => window.PunchClock?.open());

        // Logout handlers
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.addEventListener('click', () => Auth.logout());

        const drawerBtnLogout = document.getElementById('drawer-btn-logout');
        if (drawerBtnLogout) drawerBtnLogout.addEventListener('click', () => Auth.logout());

        // Mobile drawer open/close
        const btnHamburger = document.getElementById('btn-hamburger');
        const btnMobileMore = document.getElementById('btn-mobile-more');
        const btnDrawerClose = document.getElementById('btn-drawer-close');
        const drawerOverlay = document.getElementById('mobile-drawer-overlay');

        const openDrawer = () => {
            if (drawerOverlay) drawerOverlay.classList.add('open');
            const drawer = document.getElementById('mobile-drawer');
            if (drawer) drawer.classList.add('open');
        };

        if (btnHamburger) btnHamburger.addEventListener('click', openDrawer);
        if (btnMobileMore) btnMobileMore.addEventListener('click', openDrawer);
        if (btnDrawerClose) btnDrawerClose.addEventListener('click', () => this.closeMobileDrawer());

        if (drawerOverlay) {
            drawerOverlay.addEventListener('click', (e) => {
                if (e.target === drawerOverlay) {
                    this.closeMobileDrawer();
                }
            });
        }

        // Global Navigation click delegation
        document.addEventListener('click', (e) => {
            const navLink = e.target.closest('[data-route]');
            if (navLink) {
                e.preventDefault();
                const route = navLink.getAttribute('data-route');
                this.navigate(route);
                this.closeMobileDrawer();
            }
        });
    },

    closeMobileDrawer() {
        const drawerOverlay = document.getElementById('mobile-drawer-overlay');
        const drawer = document.getElementById('mobile-drawer');
        if (drawerOverlay) drawerOverlay.classList.remove('open');
        if (drawer) drawer.classList.remove('open');
    },

    showAuth() {
        document.getElementById('auth-view').style.display = 'flex';
        document.getElementById('app-view').style.display = 'none';
        document.getElementById('login-password').value = '';
    },

    showApp() {
        document.getElementById('auth-view').style.display = 'none';
        document.getElementById('app-view').style.display = 'flex';

        // Update User info in Topbar & Drawer
        const user = Auth.currentUser;
        if (user) {
            const firstName = user.full_name.split(' ')[0];
            const initial = user.full_name[0] || 'U';
            const roleName = user.role === 'admin' ? 'Administrador' : 'Estándar';

            // Topbar
            const topbarName = document.getElementById('topbar-user-name');
            if (topbarName) topbarName.textContent = firstName;

            const topbarInit = document.getElementById('topbar-user-initial');
            if (topbarInit) topbarInit.textContent = initial;

            const roleTag = document.getElementById('topbar-user-role');
            if (roleTag) {
                roleTag.textContent = roleName;
                if (user.role === 'admin') {
                    roleTag.className = 'user-role-tag';
                } else {
                    roleTag.className = 'user-role-tag';
                    roleTag.style.background = 'var(--color-accent-light)';
                    roleTag.style.color = 'var(--color-accent)';
                }
            }

            // Mobile Drawer
            const drawerName = document.getElementById('drawer-user-name');
            if (drawerName) drawerName.textContent = user.full_name;

            const drawerInit = document.getElementById('drawer-user-initial');
            if (drawerInit) drawerInit.textContent = initial;

            const drawerRole = document.getElementById('drawer-user-role');
            if (drawerRole) {
                drawerRole.textContent = roleName;
                if (user.role !== 'admin') {
                    drawerRole.style.background = 'var(--color-accent-light)';
                    drawerRole.style.color = 'var(--color-accent)';
                }
            }
        }

        // Render Sidebar and Mobile Drawer items according to user role
        this.renderNavMenus();

        // Navigate to default or current route
        this.navigate(this.currentRoute || 'dashboard');
    },

    renderNavMenus() {
        const isAdmin = Auth.isAdmin();

        const menuItems = [
            { route: 'dashboard', label: 'Panel General', icon: Icons.dashboard, adminOnly: false },
            { route: 'departments', label: 'Puestos y Deptos.', icon: Icons.departments, adminOnly: false },
            { route: 'employees', label: 'Empleados', icon: Icons.employees, adminOnly: false },
            { route: 'attendance', label: 'Asistencias', icon: Icons.attendance, adminOnly: false },
            { route: 'vacations', label: 'Vacaciones (LFT)', icon: Icons.vacations, adminOnly: false },
            { route: 'incidents', label: 'Incidencias', icon: Icons.incidents, adminOnly: false },
            { route: 'payroll', label: 'Nóminas', icon: Icons.payroll, adminOnly: false },
            { route: 'reports', label: 'Reportes', icon: Icons.reports, adminOnly: false },
            { route: 'users', label: 'Usuarios', icon: Icons.users, adminOnly: true },
            { route: 'settings', label: 'Configuración', icon: Icons.settings, adminOnly: true }
        ];

        // 1. Sidebar items (Desktop)
        const sidebarMenu = document.getElementById('sidebar-nav-menu');
        if (sidebarMenu) {
            sidebarMenu.innerHTML = `
                <li class="menu-category">Módulos RH</li>
                ${menuItems.filter(m => !m.adminOnly).map(m => `
                    <li>
                        <a href="#${m.route}" class="nav-item ${this.currentRoute === m.route ? 'active' : ''}" data-route="${m.route}">
                            ${m.icon}
                            <span>${m.label}</span>
                        </a>
                    </li>
                `).join('')}

                ${isAdmin ? `
                    <li class="menu-category" style="margin-top: 0.75rem;">Administración</li>
                    ${menuItems.filter(m => m.adminOnly).map(m => `
                        <li>
                            <a href="#${m.route}" class="nav-item ${this.currentRoute === m.route ? 'active' : ''}" data-route="${m.route}">
                                ${m.icon}
                                <span>${m.label}</span>
                            </a>
                        </li>
                    `).join('')}
                ` : ''}
            `;
        }

        // 2. Lateral Mobile Sandwich Drawer
        const drawerMenu = document.getElementById('drawer-nav-menu');
        if (drawerMenu) {
            drawerMenu.innerHTML = `
                <div class="menu-category" style="padding: 0.25rem 0.5rem 0.25rem;">Módulos RH</div>
                ${menuItems.filter(m => !m.adminOnly).map(m => `
                    <a href="#${m.route}" class="nav-item ${this.currentRoute === m.route ? 'active' : ''}" data-route="${m.route}">
                        ${m.icon}
                        <span>${m.label}</span>
                    </a>
                `).join('')}

                ${isAdmin ? `
                    <div class="menu-category" style="padding: 0.75rem 0.5rem 0.25rem;">Administración</div>
                    ${menuItems.filter(m => m.adminOnly).map(m => `
                        <a href="#${m.route}" class="nav-item ${this.currentRoute === m.route ? 'active' : ''}" data-route="${m.route}">
                            ${m.icon}
                            <span>${m.label}</span>
                        </a>
                    `).join('')}
                ` : ''}
            `;
        }
    },

    navigate(route) {
        this.currentRoute = route;

        // Role protection
        if ((route === 'users' || route === 'settings') && !Auth.isAdmin()) {
            Toast.warning('Acceso exclusivo para Administradores.');
            this.navigate('dashboard');
            return;
        }

        // Update active class in sidebar & mobile nav
        document.querySelectorAll('.nav-item').forEach(el => {
            if (el.getAttribute('data-route') === route) el.classList.add('active');
            else el.classList.remove('active');
        });

        document.querySelectorAll('.mobile-nav-btn').forEach(el => {
            if (el.getAttribute('data-route') === route) el.classList.add('active');
            else el.classList.remove('active');
        });

        const mainContainer = document.getElementById('app-main-content');
        if (!mainContainer) return;

        // Destroy previous infinity table observer if any
        if (window.EmployeesModule?.infinityTable) window.EmployeesModule.infinityTable.destroy();
        if (window.AttendanceModule?.infinityTable) window.AttendanceModule.infinityTable.destroy();
        if (window.VacationsModule?.infinityTable) window.VacationsModule.infinityTable.destroy();
        if (window.IncidentsModule?.infinityTable) window.IncidentsModule.infinityTable.destroy();
        if (window.PayrollModule?.infinityTable) window.PayrollModule.infinityTable.destroy();
        if (window.ReportsModule?.infinityTable) window.ReportsModule.infinityTable.destroy();

        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Route dispatcher
        switch (route) {
            case 'dashboard':
                DashboardModule.render(mainContainer);
                break;
            case 'departments':
                DepartmentsModule.render(mainContainer);
                break;
            case 'employees':
                EmployeesModule.render(mainContainer);
                break;
            case 'attendance':
                AttendanceModule.render(mainContainer);
                break;
            case 'vacations':
                VacationsModule.render(mainContainer);
                break;
            case 'incidents':
                IncidentsModule.render(mainContainer);
                break;
            case 'payroll':
                PayrollModule.render(mainContainer);
                break;
            case 'reports':
                ReportsModule.render(mainContainer);
                break;
            case 'users':
                UsersModule.render(mainContainer);
                break;
            case 'settings':
                SettingsModule.render(mainContainer);
                break;
            default:
                DashboardModule.render(mainContainer);
        }
    }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
