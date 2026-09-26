// Authentication State & Session Handler
const Auth = {
    currentUser: null,

    init() {
        const savedUser = localStorage.getItem('tropico56_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
            } catch (e) {
                this.currentUser = null;
            }
        }
    },

    isAuthenticated() {
        return !!API.getToken() && !!this.currentUser;
    },

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    async login(username, password) {
        try {
            const data = await API.post('/auth/login', { username, password });
            if (data.success && data.token) {
                API.setToken(data.token);
                this.currentUser = data.user;
                localStorage.setItem('tropico56_user', JSON.stringify(data.user));
                return data;
            }
            throw new Error(data.message || 'Error en el inicio de sesión.');
        } catch (error) {
            throw error;
        }
    },

    logout() {
        API.setToken(null);
        localStorage.removeItem('tropico56_user');
        this.currentUser = null;
        if (window.App) {
            window.App.showAuth();
        }
        Toast.info('Has cerrado sesión.');
    }
};

Auth.init();
window.Auth = Auth;
