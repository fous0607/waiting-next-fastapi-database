import { api } from '@/lib/api';

export interface Notice {
    id: number;
    title: string;
    content: string;
    target_type: 'all' | 'selected';
    is_active: boolean;
    created_at: string;
    author_name?: string;
    target_stores?: any[]; // Simplified for list view
}

export interface NoticeCreate {
    title: string;
    content: string;
    target_type: 'all' | 'selected';
    target_store_ids: number[];
    is_active: boolean;
}

export const noticeService = {
    // Admin: Create Notice
    createNotice: async (data: NoticeCreate): Promise<Notice> => {
        const response = await api.post('/notices/', data);
        return response.data;
    },

    // Admin: Get All Notices
    getNotices: async (): Promise<Notice[]> => {
        const response = await api.get('/notices/');
        return response.data;
    },

    // Store Manager: Get Relevant Notices
    getStoreNotices: async (): Promise<Notice[]> => {
        const response = await api.get('/notices/store');
        return response.data;
    },

    // Admin: Delete Notice
    deleteNotice: async (id: number): Promise<void> => {
        await api.delete(`/notices/${id}`);
    }
};
