/**
 * Centralized Logout Logic
 * Handles modal injection, display, and API interactions for logging out.
 */

(function () {
    // Inject Logout Modal HTML and Styles if they don't exist
    function injectLogoutModal() {
        if (document.getElementById('common-logout-modal')) return;

        const modalHtml = `
            <div id="common-logout-modal" class="common-modal-overlay">
                <div class="common-modal-content">
                    <h2 class="common-modal-title">로그아웃</h2>
                    <p class="common-modal-message">정말 로그아웃 하시겠습니까?</p>
                    <div class="common-modal-actions">
                        <button id="common-logout-cancel" class="common-btn common-btn-secondary">취소</button>
                        <button id="common-logout-confirm" class="common-btn common-btn-primary">로그아웃</button>
                    </div>
                </div>
            </div>
        `;

        const styleHtml = `
            <style>
                .common-modal-overlay {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 99999;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(2px);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .common-modal-overlay.active {
                    display: flex;
                    opacity: 1;
                }
                .common-modal-content {
                    background: white;
                    padding: 30px;
                    border-radius: 16px;
                    width: 90%;
                    max-width: 400px;
                    text-align: center;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    transform: scale(0.95);
                    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .common-modal-overlay.active .common-modal-content {
                    transform: scale(1);
                }
                .common-modal-title {
                    font-size: 22px;
                    font-weight: 700;
                    color: #2c3e50;
                    margin-bottom: 12px;
                }
                .common-modal-message {
                    font-size: 16px;
                    color: #7f8c8d;
                    margin-bottom: 25px;
                    line-height: 1.5;
                }
                .common-modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                .common-btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex: 1;
                }
                .common-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .common-btn:active {
                    transform: translateY(0);
                }
                .common-btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .common-btn-secondary {
                    background: #f1f3f5;
                    color: #495057;
                }
                .common-btn-secondary:hover {
                    background: #e9ecef;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styleHtml);
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Bind Events
        document.getElementById('common-logout-cancel').addEventListener('click', closeLogoutModal);
        document.getElementById('common-logout-confirm').addEventListener('click', executeLogout);

        // Close on overlay click
        document.getElementById('common-logout-modal').addEventListener('click', function (e) {
            if (e.target === this) closeLogoutModal();
        });
    }

    // Expose global functions
    window.showLogoutModal = function () {
        injectLogoutModal(); // Ensure it exists
        const modal = document.getElementById('common-logout-modal');
        // Small timeout to allow display:flex to apply before opacity transition
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    };

    window.closeLogoutModal = function () {
        const modal = document.getElementById('common-logout-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300); // Wait for transition
        }
    };

    // Alias for backward compatibility with existing buttons
    window.logout = function (event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        window.showLogoutModal();
    };

    window.executeLogout = async function () {
        try {
            // Close SSE connection if exists
            if (window.eventSource) {
                window.eventSource.close();
            }

            // Call API
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear all possible Storage items
            const keysToRemove = [
                'access_token',
                'refresh_token',
                'selected_store_id',
                'selected_store_name',
                'selected_store_code',
                'username',
                'user_role',
                'superadmin_franchise_context',
                'store_management_context'
            ];

            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Redirect
            window.location.replace('/');
        }
    };

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectLogoutModal);
    } else {
        injectLogoutModal();
    }

})();
