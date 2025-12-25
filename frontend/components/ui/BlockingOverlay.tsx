'use client';

import { useWaitingStore } from '@/lib/store/useWaitingStore';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

export function BlockingOverlay() {
    const { connectionBlockState } = useWaitingStore();
    const router = useRouter();

    if (!connectionBlockState) return null;

    const handleConfirm = () => {
        // Redirect to home/login and potentially clear state?
        // But store state persists in memory unless refreshed.
        // Force full reload to clear implementation details
        window.location.href = '/';
    };

    return (
        <AlertDialog open={true}>
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <AlertDialogContent className="z-50 max-w-md border-red-200">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" /></svg>
                        {connectionBlockState.type === 'blocked' ? '접속 거부' : '연결 종료'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-base text-gray-700 pt-2 leading-relaxed">
                        {connectionBlockState.message}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                    >
                        메인화면으로 이동
                    </AlertDialogAction>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
