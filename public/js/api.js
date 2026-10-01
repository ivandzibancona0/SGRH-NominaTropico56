// Centralized API Client
const API = {
    baseUrl: '/api',

    getToken() {
        return localStorage.getItem('tropico56_token');
    },

    setToken(token) {
        if (token) localStorage.setItem('tropico56_token', token);
        else localStorage.removeItem('tropico56_token');
    },

    getHeaders(isMultipart = false) {
        const headers = {};
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        if (!isMultipart) {
            headers['Content-Type'] = 'application/json';
        }
        return headers;
    },

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const isMultipart = options.body instanceof FormData;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(isMultipart),
                ...(options.headers || {})
            }
        };

        if (options.body && !isMultipart && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const res = await fetch(url, config);
            
            if (res.status === 401 && !endpoint.startsWith('/auth/')) {
                // Unauthorized / Token expired
                this.setToken(null);
                localStorage.removeItem('tropico56_user');
                if (window.App && window.App.showAuth) {
                    window.App.showAuth();
                }
                throw new Error('Sesión expirada. Inicie sesión nuevamente.');
            }

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || `Error en la petición (${res.status})`);
            }
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body });
    },

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

window.API = API;
