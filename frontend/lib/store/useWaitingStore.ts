
import { create } from 'zustand';
import { api } from '../api';

export interface ClassInfo {
    id: number;
    class_name: string;
    class_number: number;
    start_time: string;
    end_time: string;
    max_capacity: number;
    current_count: number;
    total_count: number;
}

export interface WaitingItem {
    id: number;
    waiting_number: number;
    name: string;
    phone: string;
    class_id: number;
    class_order: number;
    status: 'waiting' | 'called' | 'attended' | 'cancelled';
    registered_at: string;
    message?: string;
    is_empty_seat?: boolean;
    member_id?: number;
    revisit_count?: number;
    total_party_size?: number;
    party_size_details?: string;
    call_count?: number;
}

export interface StoreSettings {
    store_name: string;
    calling_status_display_second: number;
    business_start_time: string;
    business_end_time: string;
    enable_break_time: boolean;
    break_start_time: string;
    break_end_time: string;
    operation_type: 'general' | 'dining';
    party_size_config?: string;
    enable_party_size?: boolean;
    enable_menu_ordering?: boolean;
    detail_mode?: 'standard' | 'pickup';

    // Voice Settings
    enable_waiting_voice_alert?: boolean;
    enable_calling_voice_alert?: boolean;
    enable_manager_calling_voice_alert?: boolean;
    manager_calling_voice_message?: string;
    enable_manager_entry_voice_alert?: boolean;
    manager_entry_voice_message?: string;
    waiting_voice_name?: string | null;
    waiting_voice_rate?: number;
    waiting_voice_pitch?: number;
    waiting_call_voice_repeat_count?: number;
    waiting_voice_message?: string | null;
    waiting_call_voice_message?: string | null;
    enable_duplicate_registration_voice?: boolean;
    duplicate_registration_voice_message?: string | null;

    // Add other settings as needed
    [key: string]: any;
}

interface WaitingState {
    // Data
    classes: ClassInfo[];
    waitingList: Record<number, WaitingItem[]>;
    storeName: string;
    storeSettings: StoreSettings | null;
    businessDate: string;

    // UI State
    currentClassId: number | null;
    selectedStoreId: string | null; // Added for reactive state
    isLoading: boolean;
    closedClasses: Set<number>;
    isConnected: boolean;
    hideClosedClasses: boolean;
    sequentialClosing: boolean;
    revisitBadgeStyle: string;

    syncToken: string | null;
    setSyncToken: (token: string | null) => void;

    // Connection Blocking State (For Ejection/Blocking UI)
    connectionBlockState: { type: 'ejected' | 'blocked', message: string } | null;

    // Actions
    setConnected: (status: boolean) => void;
    setConnectionBlockState: (state: { type: 'ejected' | 'blocked', message: string } | null) => void;
    toggleHideClosedClasses: () => void;
    fetchClasses: () => Promise<void>;
    selectClass: (classId: number) => void;
    fetchWaitingList: (classId: number) => Promise<void>;
    fetchStoreStatus: () => Promise<void>;
    setStoreId: (id: string) => void; // Added for reactive state

    // Real-time Event Handlers
    handleNewUser: () => void;
    handleStatusChange: () => void;
    handleOrderChange: () => void;
    handleClassClosed: (classId: number) => void;
    handleClassReopened: (classId: number) => void;


    syncCheck: () => Promise<void>;
    refreshAll: () => Promise<void>; // Consolidated refresh actions

    // Admin Actions
    closeClass: (classId: number) => Promise<void>;
    reorderWaitingList: (classId: number, fromIndex: number, toIndex: number) => void;
    incrementCallCount: (classId: number, waitingId: number) => void;
    reset: () => void;
}

export const useWaitingStore = create<WaitingState>((set, get) => ({
    classes: [],
    waitingList: {},
    storeName: '',
    storeSettings: null,
    businessDate: '',
    currentClassId: null,
    selectedStoreId: typeof window !== 'undefined' ? localStorage.getItem('selected_store_id') : null,
    closedClasses: new Set(),
    isConnected: false,
    hideClosedClasses: true, // Default to hidden
    sequentialClosing: false,
    revisitBadgeStyle: 'indigo_solid',
    syncToken: null,
    connectionBlockState: null,
    isLoading: true,

    setStoreId: (id: string) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('selected_store_id', id);
        }
        set({ selectedStoreId: id });
    },

    setConnected: (status) => set({ isConnected: status }),
    setSyncToken: (token) => set({ syncToken: token }),
    setConnectionBlockState: (state) => set({ connectionBlockState: state }),
    toggleHideClosedClasses: () => set((state) => ({ hideClosedClasses: !state.hideClosedClasses })),

    fetchStoreStatus: async () => {
        try {
            // Fetch Store Name
            const storeRes = await api.get('/store');
            // Endpoint returns List[Store], need to handle array and 'name' field
            const storeData = Array.isArray(storeRes.data) ? storeRes.data[0] : storeRes.data;
            const storeName = storeData?.name || storeData?.store_name || '매장 정보 없음';

            // Auto-set selectedStoreId if missing (fixes SSE connection on direct load)
            if (storeData && storeData.id && !get().selectedStoreId) {
                const idStr = String(storeData.id);
                set({ selectedStoreId: idStr });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('selected_store_id', idStr);
                }
            }

            // Fetch Business Date (Active closing or calculated)
            const dateRes = await api.get('/daily/predict-date');
            set({
                storeName: storeName,
                storeSettings: storeData, // Store the full settings object
                businessDate: dateRes.data.business_date || '미개점',
                sequentialClosing: storeData?.sequential_closing ?? false,
                revisitBadgeStyle: storeData?.revisit_badge_style ?? 'indigo_solid'
            });

        } catch (error) {
            console.error('[Store] Failed to fetch status:', error);
            set({ storeName: '매장 정보 없음' });
        } finally {
            set({ isLoading: false });
        }
    },

    fetchClasses: async () => {
        try {
            console.log("Fetching classes...");
            const timestamp = Date.now();
            // 1. Fetch Closed Classes
            const closedRes = await api.get(`/board/closed-classes?_t=${timestamp}`);
            const closedIds = new Set<number>(closedRes.data.closed_class_ids);

            // 2. Fetch Classes with counts
            const res = await api.get(`/waiting/list/by-class?_t=${timestamp}`);
            console.log("Classes response:", res.data);

            if (!res.data || res.data.length === 0) {
                console.warn("No classes returned from API");
            }

            const classesData: ClassInfo[] = res.data.map((cls: {
                class_id: number;
                class_name: string;
                class_number: number;
                start_time: string;
                end_time: string;
                max_capacity: number;
                current_count: number;
                total_count?: number;
            }) => ({
                id: cls.class_id,
                class_name: cls.class_name,
                class_number: cls.class_number,
                start_time: cls.start_time,
                end_time: cls.end_time,
                max_capacity: cls.max_capacity,
                current_count: cls.current_count,
                total_count: cls.total_count || cls.current_count
            }));

            set({
                classes: classesData,
                closedClasses: closedIds
            });
            console.log("Classes state updated:", classesData);

            // Auto-select first visible class if none selected
            if (!get().currentClassId && classesData.length > 0) {
                const state = get();
                // Determine which classes would be visible on screen
                const visibleClasses = classesData.filter(c => !state.hideClosedClasses || !closedIds.has(c.id));

                if (visibleClasses.length > 0) {
                    // Select the first class on the screen
                    set({ currentClassId: visibleClasses[0].id });
                    get().fetchWaitingList(visibleClasses[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to fetch classes:', error);
        }
    },

    selectClass: (classId) => {
        set({ currentClassId: classId });
        get().fetchWaitingList(classId);
    },

    fetchWaitingList: async (classId) => {
        try {
            const res = await api.get(`/waiting/list?status=waiting,called&class_id=${classId}&_t=${Date.now()}`);
            set((state) => ({
                waitingList: {
                    ...state.waitingList,
                    [classId]: res.data
                }
            }));
        } catch (error) {
            console.error(`Failed to fetch waiting list for class ${classId}:`, error);
        }
    },

    handleNewUser: async () => {
        await get().fetchClasses();
        // Re-check currentClassId from fresh state after fetchClasses might have auto-selected one
        const freshState = get();
        if (freshState.currentClassId) {
            await get().fetchWaitingList(freshState.currentClassId!);
        }
    },

    handleStatusChange: async () => {
        await get().fetchClasses();
        const freshState = get();
        if (freshState.currentClassId) {
            await get().fetchWaitingList(freshState.currentClassId!);
        }
    },

    handleOrderChange: () => {
        if (get().currentClassId) {
            get().fetchWaitingList(get().currentClassId!);
        }
    },

    syncCheck: async () => {
        const { selectedStoreId, syncToken, refreshAll } = get();

        // Robust ID validation
        if (!selectedStoreId || typeof selectedStoreId !== 'string' || selectedStoreId === '[object Object]') {
            return;
        }

        try {
            const res = await api.get(`/polling/sync-check/${selectedStoreId}`);
            const newToken = res.data.sync_token;

            if (newToken && newToken !== syncToken) {
                console.log(`[Polling] Data changed (Token: ${newToken}). Refreshing...`);
                await refreshAll();
                set({ syncToken: newToken });
            }
        } catch (error) {
            console.error('[Polling] Sync check failed:', error);
            // Optionally clear token on persistent errors to force refresh on next success
        }
    },

    refreshAll: async () => {
        // Optimized refresh: Fetch classes once, then fetch waiting list for current class once
        await get().fetchClasses();
        const freshState = get();
        if (freshState.currentClassId) {
            await get().fetchWaitingList(freshState.currentClassId!);
        }
    },

    handleClassClosed: (classId) => {
        set((state) => {
            const newClosed = new Set(state.closedClasses);
            newClosed.add(classId);
            return { closedClasses: newClosed };
        });
        // If the closed class is currently selected, refresh the list (it should be empty now)
        if (get().currentClassId === classId) {
            get().fetchWaitingList(classId);
        }
    },

    handleClassReopened: (classId) => {
        set((state) => {
            const newClosed = new Set(state.closedClasses);
            newClosed.delete(classId);
            return { closedClasses: newClosed };
        });
        if (get().currentClassId === classId) {
            get().fetchWaitingList(classId);
        }
    },

    closeClass: async (classId) => {
        try {
            await api.post('/board/batch-attendance', { class_id: classId });
            await get().fetchClasses(); // Refresh to update closed status
            get().fetchWaitingList(classId); // Refresh to clear the list

            // Auto-switch to next active class if hiding is enabled and we just closed the current one
            const state = get();
            if (state.hideClosedClasses && state.currentClassId === classId) {
                const classes = state.classes;
                const closed = state.closedClasses;

                // Find current index
                const currentIndex = classes.findIndex(c => c.id === classId);
                if (currentIndex !== -1) {
                    // Try to find next open class after current
                    let nextClass = classes.slice(currentIndex + 1).find(c => !closed.has(c.id));

                    // If not found, try from beginning
                    if (!nextClass) {
                        nextClass = classes.find(c => !closed.has(c.id));
                    }

                    if (nextClass) {
                        get().selectClass(nextClass.id);
                    } else {
                        // If no open class found (all closed), deselect current so it disappears from filtered view
                        set({ currentClassId: null });
                        get().fetchWaitingList(-1); // Clear waiting list (or handle null)
                    }
                }
            }
        } catch (error) {
            console.error('Failed to close class:', error);
            throw error; // Re-throw for UI to handle
        }
    },

    reorderWaitingList: (classId: number, fromIndex: number, toIndex: number) => {
        set((state) => {
            const list = state.waitingList[classId] || [];
            if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
                return state;
            }

            const newList = [...list];
            const [movedItem] = newList.splice(fromIndex, 1);
            newList.splice(toIndex, 0, movedItem);

            return {
                waitingList: {
                    ...state.waitingList,
                    [classId]: newList
                }
            };
        });
    },

    reset: () => set({
        classes: [],
        waitingList: {},
        storeName: '',
        businessDate: '',
        currentClassId: null,
        closedClasses: new Set(),
        isConnected: false,
        connectionBlockState: null,
        isLoading: false
    }),

    incrementCallCount: (classId, waitingId) => {
        set((state) => {
            const list = state.waitingList[classId];
            if (!list) return state;

            const newList = list.map(item =>
                item.id === waitingId
                    ? { ...item, call_count: (item.call_count || 0) + 1 }
                    : item
            );

            return {
                waitingList: {
                    ...state.waitingList,
                    [classId]: newList
                }
            };
        });
    }
}));
