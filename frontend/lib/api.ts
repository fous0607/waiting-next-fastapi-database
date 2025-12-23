
import axios from 'axios';

// Create a configured axios instance
export const api = axios.create({
    // baseURL is handled in the interceptor to ensure correct environment detection (SSR vs Client)
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Request interceptor to add baseURL and auth headers
api.interceptors.request.use(
    (config) => {
        // 1. Dynamic baseURL determination
        if (!config.baseURL) {
            const isClient = typeof window !== 'undefined';
            console.log(`[API Interceptor] Env Check: isClient=${isClient}, typeof window=${typeof window}`);

            if (isClient) {
                config.baseURL = '/api'; // Client-side: Relative path
                console.log('[API Interceptor] Selected Client BaseURL: /api');
            } else {
                // Server-side: Docker internal URL
                config.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000/api';
                console.log(`[API Interceptor] Selected Server BaseURL: ${config.baseURL}`);
            }
        }

        // 2. Add X-Store-Id and Authorization headers (Browser only)
        if (typeof window !== 'undefined') {
            const storeId = localStorage.getItem('selected_store_id');
            if (storeId) {
                config.headers['X-Store-Id'] = storeId;
            }

            const token = localStorage.getItem('access_token');
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for global error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
            console.warn('[API] 401 Unauthorized - Redirecting to login');

            // Avoid infinite loop if logout itself fails
            if (error.config?.url?.includes('/auth/logout')) {
                return Promise.reject(error);
            }

            // Check if we are in the browser and not already on the login page
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                // Clear localStorage token
                localStorage.removeItem('access_token');

                // Try to clear HttpOnly cookie via server logout (fire and forget)
                // We use fetch here to avoid circular dependency or interceptor loops
                try {
                    const baseURL = error.config?.baseURL || '/api';
                    fetch(`${baseURL}/auth/logout`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }).catch(console.error);
                } catch (e) {
                    console.error('Failed to trigger server logout', e);
                }

                // Force a hard navigation to login
                window.location.href = '/login';
            }
        }

        // Handle network errors (backend server down)
        if (typeof window !== 'undefined' && error.code === 'ERR_NETWORK') {
            console.error('[API] Network Error - Backend server may be down');

            // Show user-friendly message
            const message = '서버와의 연결이 끊어졌습니다.\n잠시 후 자동으로 복구됩니다.';

            // Try to use toast if available, otherwise use alert
            if (typeof window !== 'undefined') {
                // Check if we have a toast function available
                const showToast = (window as any).showToast;
                if (showToast && typeof showToast === 'function') {
                    showToast(message, 'error');
                } else {
                    // Fallback to a styled alert
                    const overlay = document.createElement('div');
                    overlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                    `;

                    const modal = document.createElement('div');
                    modal.style.cssText = `
                        background: white;
                        padding: 32px;
                        border-radius: 16px;
                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                        max-width: 400px;
                        text-align: center;
                    `;

                    modal.innerHTML = `
                        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                        <div style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #333;">
                            서버 연결 끊김
                        </div>
                        <div style="font-size: 15px; color: #666; line-height: 1.6; margin-bottom: 24px;">
                            백엔드 서버와의 연결이 끊어졌습니다.<br>
                            잠시 후 자동으로 복구됩니다.
                        </div>
                        <div style="font-size: 13px; color: #999;">
                            이 메시지는 3초 후 자동으로 사라집니다.
                        </div>
                    `;

                    overlay.appendChild(modal);
                    document.body.appendChild(overlay);

                    // Auto-remove after 3 seconds
                    setTimeout(() => {
                        document.body.removeChild(overlay);
                    }, 3000);
                }
            }
        }

        // Handle 500 Internal Server Error
        if (error.response?.status === 500) {
            console.error('[API] 500 Internal Server Error');
            if (typeof window !== 'undefined') {
                const showToast = (window as any).showToast;
                if (showToast && typeof showToast === 'function') {
                    showToast('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;
