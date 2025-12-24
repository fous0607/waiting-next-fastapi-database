import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Monitor, Power, Smartphone, Shield, HelpCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConnectionInfo {
    id: string;
    role: string;
    ip: string;
    user_agent: string;
    connected_at: string;
}

interface SSEMonitorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    storeId?: string;
}

export function SSEMonitor({ open, onOpenChange, storeId }: SSEMonitorProps) {
    const [connections, setConnections] = useState<ConnectionInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            // If storeId is provided (Superadmin viewing specific store), pass it.
            // Otherwise, backend uses current user's store context.
            const params = storeId ? { store_id: storeId } : {};
            const { data } = await api.get<ConnectionInfo[]>('/system/sse/status', { params });
            setConnections(data);
        } catch (error) {
            console.error("Failed to fetch SSE status:", error);
            toast.error("연결 상태를 불러오는데 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (open) {
            fetchStatus();
            const interval = setInterval(fetchStatus, 5000); // 5초마다 갱신
            return () => clearInterval(interval);
        }
    }, [open, fetchStatus]);

    const handleDisconnect = async (connectionId: string) => {
        if (!confirm("해당 기기의 연결을 끊고 재접속을 유도하시겠습니까?")) return;

        try {
            await api.post(`/system/sse/disconnect/${connectionId}`, {}, {
                params: storeId ? { store_id: storeId } : {}
            });
            toast.success("재연결 명령을 보냈습니다.");
            fetchStatus();
        } catch (error) {
            toast.error("명령 전송 실패");
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin': return <Shield className="w-4 h-4 text-purple-500" />;
            case 'board': return <Monitor className="w-4 h-4 text-blue-500" />;
            case 'reception': return <Smartphone className="w-4 h-4 text-green-500" />;
            default: return <HelpCircle className="w-4 h-4 text-gray-500" />;
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return '관리자 (Manager)';
            case 'board': return '대기현황판 (Board)';
            case 'reception': return '접수대 (Reception)';
            default: return role;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            실시간 연결 모니터링
                        </DialogTitle>
                        <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={isLoading}>
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                    <DialogDescription>
                        현재 매장에 연결된 실시간 통신(SSE) 기기 목록입니다. <br />
                        특정 기기가 업데이트되지 않는다면 [연결 끊기]를 눌러 재접속을 유도해보세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 border rounded-md">
                    <div className="bg-slate-50 p-2 grid grid-cols-12 text-xs font-bold text-slate-500 border-b text-center">
                        <div className="col-span-1">상태</div>
                        <div className="col-span-3 text-left pl-2">역할</div>
                        <div className="col-span-3">IP 주소</div>
                        <div className="col-span-3">접속 시간</div>
                        <div className="col-span-2">관리</div>
                    </div>
                    <ScrollArea className="h-[300px]">
                        {connections.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-10 text-slate-400">
                                <Monitor className="w-10 h-10 mb-2 opacity-20" />
                                <p>연결된 기기가 없습니다.</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {connections.map((conn) => (
                                    <div key={conn.id} className="grid grid-cols-12 text-sm p-3 items-center hover:bg-slate-50 transition-colors">
                                        <div className="col-span-1 text-center">
                                            <div className="w-2 h-2 rounded-full bg-green-500 mx-auto" />
                                        </div>
                                        <div className="col-span-3 flex items-center gap-2 font-medium">
                                            {getRoleIcon(conn.role)}
                                            <span className="truncate" title={conn.role}>{getRoleLabel(conn.role)}</span>
                                        </div>
                                        <div className="col-span-3 text-center font-mono text-xs text-slate-600 truncate" title={conn.ip}>
                                            {conn.ip}
                                        </div>
                                        <div className="col-span-3 text-center text-xs text-slate-500">
                                            {new Date(conn.connected_at).toLocaleTimeString()}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => handleDisconnect(conn.id)}
                                                        >
                                                            <Power className="w-4 h-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>강제 재연결</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="flex justify-end mt-2">
                    <div className="text-xs text-slate-400 flex gap-4">
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 관리자화면</span>
                        <span className="flex items-center gap-1"><Monitor className="w-3 h-3" /> 대기현황판</span>
                        <span className="flex items-center gap-1"><Smartphone className="w-3 h-3" /> 데스크(접수)</span>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}
