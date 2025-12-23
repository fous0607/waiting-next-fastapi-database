# Frontend & API Configuration Fixes Summary

This document summarizes the technical fixes and configuration updates performed to resolve frontend errors, authentication issues, and external access connectivity problems.

## 1. Port Synchronization (8088)
The backend was confirmed to be running on port **8088**. The frontend and API configurations were updated to ensure consistent communication:
- **`frontend/lib/api.ts`**: Updated `getBaseUrl` to use port `8088`.
- **`frontend/hooks/useSSE.ts`**: Updated Server-Sent Events connection to port `8088`.
- **`frontend/next.config.ts`**: Updated development rewrites (`/api`, `/dashboard`, `/static`) to proxy requests to `127.0.0.1:8088`.
- **`backend/main.py`**: Updated the default uvicorn port to **8088** in the entry point script.

## 2. External Access Fix (CORS)
Resolved the `AxiosError: Network Error` occurring when accessing from the external IP `192.168.0.115`:
- **CORS Origins**: Updated `backend/main.py` to include `http://192.168.0.115:3000` and `http://0.0.0.0:3000` in the allowed origins list.
- **Listen Address**: Verified both Backend (uvicorn) and Frontend (Next.js) are listening on `0.0.0.0` to allow cross-device communication.

## 3. Authentication & Error Handling
- **401 Unauthorized**: Implemented a global response interceptor in `api.ts`. If an API call returns a `401` status (session expired or invalid token), the application automatically clears the local storage and redirects the user to the `/login` page.
- **Type Safety**: Converted numerous `any` types to specific interfaces in `Board`, `Reception`, and `Zustand` store components to prevent runtime crashes.

## 4. UI Clean-up
- Resolved linting errors (`@typescript-eslint/no-unused-vars`, `react-hooks/set-state-in-effect`) in `WaitingList.tsx`, `ClassManagement.tsx`, and `GeneralSettings.tsx`.
- Removed unused imports and cleaned up the `calendar.tsx` component.
- Verified Korean grammatical correctness across all major UI labels.

## 5. Real-time Update Fixes (SSE)
- **Header Casing**: Standardized `X-Store-Id` header casing across all API calls to match backend expectations.
- **Dynamic Store ID**: Removed hardcoded store ID `'1'` in `ManagePage` and implemented dynamic extraction from URL parameters (`?store=...`).
- **SSE Connection Strategy**: Refactored `useSSE` hook to be reactive to `storeId` changes, ensuring that the real-time stream correctly reconnects when switching store contexts.
- **Reception Sync**: Added logic to `ReceptionPage` to synchronize the store ID from the URL to local storage, ensuring registrations occur in the correct store context for immediate display in the manager.
## 6. Multi-network & Proxy Support (SSE)
- **Proxy-Aware Redirection**: Changed EventSource to use a relative path (`/api/sse/stream`) instead of a direct IP/port. This allows SSE traffic to flow through the Next.js dev proxy (Port 3000), which is essential for external network access where only one port might be exposed.
- **Reactive Stream Handling**: Integrated `selectedStoreId` directly into the `useSSE` hook's dependency array. The connection now automatically drops and re-establishes whenever the store context changes, preventing data leaks between store views.
- **Authentication in SSE**: Since `EventSource` does not support custom headers, the authentication token is now passed via a secured query parameter (`?token=...`), which the backend's `get_current_user` dependency is already configured to handle.
- **Visual Status Feedback**: Added a real-time status indicator (pulsing dot) to the `ManageHeader` to give users immediate feedback on the connection health.

---
**Status**: All fixes applied and verified. Real-time updates are now robust across different networks and store contexts.
