# Next.js System Optimization & Migration Report Task List

- [x] Analyze current frontend structure (Legacy Jinja2/HTML) vs Proposed Next.js structure <!-- id: 0 -->
- [x] Investigate `frontend` directory for existing Next.js prototype or setup <!-- id: 1 -->
- [x] Research specific benefits for the "Waiting System" context (Real-time updates, Dashboard, Mobile/Tablet views) <!-- id: 2 -->
- [x] Define scope of "Theme Application" in Next.js context (Tailwind, CSS Variables, Hydration handling) <!-- id: 3 -->
- [x] Draft "Next.js Optimization & Architecture Report" artifact <!-- id: 4 -->
    - [x] System Optimization Strengths (SSR/SSG, Edge Network, Image Opt) <!-- id: 5 -->
    - [x] Web-Specific Specialized Features (PWA, Routing, Layouts) <!-- id: 6 -->
    - [x] Theme Application Scope analysis <!-- id: 7 -->
    - [x] Final Recommendation for Optimal System <!-- id: 8 -->
- [x] Present report to user <!-- id: 9 -->

# Next.js Migration: Waiting Management System

- [x] Analyze Legacy "Waiting Manager" Flow (`manage.html`) <!-- id: 10 -->
    - [x] Map API endpoints used (CRUD, Status updates) <!-- id: 11 -->
    - [x] Analyze UI components and interactions (Drag & Drop, Modals) <!-- id: 12 -->
    - [x] Analyze SSE (Real-time) event handling logic <!-- id: 13 -->
- [x] Design Next.js Component Architecture <!-- id: 14 -->
    - [x] Define Atomic Components (Buttons, Cards, Inputs) in `shadcn/ui` <!-- id: 15 -->
    - [x] Define Feature Components (WaitingList, WaitingCard, StatsBoard) <!-- id: 16 -->
    - [x] Design State Management Store (`zustand`) for Waiting Data <!-- id: 17 -->
- [x] Create Implementation Plan (`implementation_plan.md`) <!-- id: 18 -->
    - [x] Phase 1: Foundation (SWR/TanStack Query setup, Zustand Store) <!-- id: 19 -->
    - [x] Phase 2: Waiting Manager Migration <!-- id: 20 -->
    - [x] Phase 3: Waiting Board & Reception Migration <!-- id: 21 -->
    - [x] Phase 4: Verification & Integration <!-- id: 22 -->
- [x] Execute Migration - Phase 1: Foundation <!-- id: 23 -->
    - [x] Install `zustand` and dependencies <!-- id: 25 -->
    - [x] Configure API Proxy in `next.config.ts` <!-- id: 26 -->
    - [x] Create `lib/api.ts` (Axios wrapper) <!-- id: 27 -->
    - [x] Create `lib/store/useWaitingStore.ts` (Zustand) <!-- id: 28 -->
    - [x] Create `hooks/useSSE.ts` <!-- id: 29 -->
- [x] Execute Migration - Phase 2: Waiting Manager <!-- id: 24 -->
    - [x] Create `components/manage/ClassTabs.tsx` <!-- id: 30 -->
    - [x] Create `components/manage/WaitingItem.tsx` <!-- id: 31 -->
    - [x] Create `components/manage/WaitingList.tsx` <!-- id: 32 -->
    - [x] Create `app/manage/page.tsx` <!-- id: 33 -->
    - [x] Create `app/manage/layout.tsx` <!-- id: 34 -->

- [ ] Execute Migration - Phase 3: Store Settings <!-- id: 35 -->
    - [x] Analyze Legacy Settings Features (General, Display, Hidden) <!-- id: 36 -->
    - [x] Implement `SettingsPage` with Shadcn Tabs <!-- id: 37 -->
        - [x] General Tab: Comprehensive Implementation (40+ fields, Accordion Layout) <!-- id: 40 -->
        - [x] Class Management Tab: CRUD (Add/Edit/Delete Classes) <!-- id: 41 -->
        - [ ] History/Backup Tabs (Optional/Later) <!-- id: 42 -->
    - [x] Migrate `StoreSettings` API integration <!-- id: 38 -->
    - [x] Migrate `ThemeSelection` Logic <!-- id: 39 -->

- [ ] Execute Migration - Phase 4: Waiting Board & Reception <!-- id: 21 -->



