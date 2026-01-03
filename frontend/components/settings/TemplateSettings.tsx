"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
// import { ScrollArea } from '@/components/ui/scroll-area'; // Removed to fix build
import { Plus, Trash2, Printer, Save, FileText, Check, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Types
interface PrintTemplate {
    id: number;
    store_id: number;
    name: string;
    content: string;
    template_type: string;
    is_active: boolean;
    created_at?: string;
}

const DEFAULT_TEMPLATE = `
{ALIGN:CENTER}{BOLD:ON}{SIZE:BIG}{STORE_NAME}

{SIZE:NORMAL}{BOLD:OFF}--------------------------------

{ALIGN:CENTER}{SIZE:NORMAL}대기번호
{SIZE:HUGE}{BOLD:ON}{WAITING_NUMBER}

{SIZE:NORMAL}{BOLD:OFF}--------------------------------

{DATE}

{ALIGN:CENTER}{QR}
{ALIGN:CENTER}** completed **


{CUT}
`.trim();

const VARIABLES = [
    { code: "{STORE_NAME}", label: "매장명", desc: "매장 이름 출력" },
    { code: "{WAITING_NUMBER}", label: "대기번호", desc: "대기 번호 (예: 101)" },
    { code: "{DATE}", label: "날짜/시간", desc: "발권 시간" },
    { code: "{PEOPLE}", label: "인원수", desc: "총 인원 또는 상세 인원" },
    { code: "{TEAMS_AHEAD}", label: "내 앞 대기", desc: "앞 대기 팀 수" },
    { code: "{ORDER}", label: "대기순서", desc: "현재 대기 순서" },
    { code: "{QR}", label: "QR코드", desc: "상태 확인 QR (설정 시)" },
];

const FORMAT_TAGS = [
    { code: "{ALIGN:CENTER}", label: "가운데 정렬" },
    { code: "{ALIGN:LEFT}", label: "왼쪽 정렬" },
    { code: "{ALIGN:RIGHT}", label: "오른쪽 정렬" },
    { code: "{BOLD:ON}", label: "굵게 시작" },
    { code: "{BOLD:OFF}", label: "굵게 끝" },
    { code: "{SIZE:NORMAL}", label: "보통 크기" },
    { code: "{SIZE:BIG}", label: "크게" },
    { code: "{SIZE:HUGE}", label: "아주 크게" },
    { code: "{CUT}", label: "용지 절단" },
    { code: "{LINE}", label: "구분선 (---------)" },
];

export function TemplateSettings() {
    const [templates, setTemplates] = useState<PrintTemplate[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Partial<PrintTemplate> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial Fetch
    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            // Need store_id. Using localStorage as per SettingsPage logic
            const storeId = localStorage.getItem('selected_store_id');
            if (!storeId) return;

            const { data } = await api.get(`/templates/${storeId}`);
            setTemplates(data);

            // Auto select active one or first one
            const active = data.find((t: PrintTemplate) => t.is_active);
            if (active) {
                // Don't auto-edit, just highlight?
            }
        } catch (error) {
            console.error("Failed to fetch templates:", error);
            toast.error("템플릿 목록을 불러오지 못했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingTemplate({
            name: "새 템플릿",
            content: DEFAULT_TEMPLATE,
            template_type: "waiting_ticket",
            is_active: false
        });
        setActiveId(null); // Deselect list when creating new
    };

    const handleEdit = (template: PrintTemplate) => {
        setActiveId(template.id);
        setEditingTemplate({ ...template });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/templates/${id}`);
            toast.success("삭제되었습니다.");
            fetchTemplates();
            if (activeId === id) {
                setActiveId(null);
                setEditingTemplate(null);
            }
        } catch (error) {
            toast.error("삭제 실패");
        }
    };

    const handleSave = async () => {
        if (!editingTemplate || !editingTemplate.name) return;
        setIsSaving(true);
        try {
            const storeId = parseInt(localStorage.getItem('selected_store_id') || "0");

            if ('id' in editingTemplate && editingTemplate.id) {
                // Update
                await api.put(`/templates/${editingTemplate.id}`, editingTemplate);
                toast.success("저장되었습니다.");
            } else {
                // Create
                await api.post(`/templates/`, { ...editingTemplate, store_id: storeId });
                toast.success("생성되었습니다.");
            }
            fetchTemplates();
            setEditingTemplate(null);
            setActiveId(null);
        } catch (error) {
            console.error(error);
            toast.error("저장에 실패했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleActive = async (template: PrintTemplate) => {
        try {
            await api.put(`/templates/${template.id}`, { is_active: true });
            toast.success("기본 양식으로 설정되었습니다.");
            fetchTemplates();
        } catch (error) {
            toast.error("설정 실패");
        }
    };

    const insertCode = (code: string) => {
        setEditingTemplate(prev => {
            if (!prev) return null;

            // Try to find textarea and insert at cursor
            const textarea = document.querySelector('textarea');
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = prev.content || "";

                const before = text.substring(0, start);
                const after = text.substring(end);

                // Restoration of focus/cursor is tricky in React state update cycle without refs
                // For now, this logic updates CONTENT correctly at cursor.
                // Re-focusing might need useEffect or direct DOM manipulation after render.

                // Let's just update content.
                return { ...prev, content: before + code + after };
            }

            return { ...prev, content: (prev.content || "") + code };
        });
        toast.info("코드가 추가되었습니다.", { duration: 1000 });
    };

    return (
        <div className="flex h-[800px] border rounded-lg overflow-hidden bg-white shadow-sm">
            {/* Sidebar List */}
            <div className="w-64 border-r bg-slate-50 flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <LayoutTemplate className="w-4 h-4" /> 양식 목록
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div className="p-2 space-y-2">
                        {templates.map(t => (
                            <div
                                key={t.id}
                                onClick={() => handleEdit(t)}
                                className={cn(
                                    "p-3 rounded-md cursor-pointer border transition-all hover:bg-white hover:shadow-sm",
                                    activeId === t.id ? "bg-white border-blue-500 shadow-sm ring-1 ring-blue-500" : "border-transparent hover:border-slate-200"
                                )}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-sm truncate">{t.name}</span>
                                    {t.is_active && <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-700 hover:bg-blue-100">사용중</Badge>}
                                </div>
                                <p className="text-[10px] text-slate-400 truncate">{t.created_at?.substring(0, 10)}</p>
                            </div>
                        ))}

                        {templates.length === 0 && !isLoading && (
                            <div className="text-center py-8 text-xs text-slate-400">
                                등록된 양식이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-3 border-t bg-slate-50">
                    <Button onClick={handleCreate} className="w-full" size="sm">
                        <Plus className="w-4 h-4 mr-2" /> 새 양식 추가
                    </Button>
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {editingTemplate ? (
                    <>
                        {/* Header */}
                        <div className="h-14 border-b flex items-center justify-between px-4 bg-white">
                            <div className="flex items-center gap-2 flex-1 mr-4">
                                <Label className="whitespace-nowrap w-16">양식명</Label>
                                <Input
                                    value={editingTemplate.name}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                    className="h-8 max-w-sm"
                                    placeholder="양식 이름을 입력하세요"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                {(activeId && !editingTemplate.is_active) && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => toggleActive(templates.find(t => t.id === activeId)!)}
                                        className="h-8 text-xs"
                                    >
                                        <Check className="w-3 h-3 mr-1" /> 이 양식 사용하기
                                    </Button>
                                )}
                                {activeId && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(activeId)}
                                        className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8">
                                    <Save className="w-3.5 h-3.5 mr-1" /> 저장
                                </Button>
                            </div>
                        </div>

                        {/* Editor Body */}
                        <div className="flex-1 flex min-h-0">
                            {/* Text Area */}
                            <div className="flex-1 p-4 bg-slate-100 flex flex-col gap-2">
                                <Label>출력 내용 디자인</Label>
                                <textarea
                                    className="flex-1 w-full p-4 font-mono text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editingTemplate.content}
                                    onChange={e => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                                    spellCheck={false}
                                />
                                <div className="flex justify-end">
                                    <Button variant="outline" size="sm" onClick={() => toast.info("프린터 연결 필요 (구현 예정)")}>
                                        <Printer className="w-3.5 h-3.5 mr-1" /> 테스트 출력
                                    </Button>
                                </div>
                            </div>

                            {/* Right Sidebar: Code List */}
                            <div className="w-64 border-l bg-slate-50 flex flex-col">
                                <div className="p-3 border-b text-xs font-semibold text-slate-600 bg-slate-100">
                                    데이터 필드 (클릭하여 삽입)
                                </div>
                                <div className="flex-1 overflow-y-auto no-scrollbar">
                                    <div className="p-2 space-y-1">
                                        {VARIABLES.map(v => (
                                            <button
                                                key={v.code}
                                                onClick={() => insertCode(v.code)}
                                                className="w-full text-left px-3 py-2 rounded border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all flex flex-col group"
                                            >
                                                <span className="text-xs font-bold text-blue-600 font-mono group-hover:text-blue-700">{v.code}</span>
                                                <span className="text-[10px] text-slate-500">{v.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="p-3 border-y text-xs font-semibold text-slate-600 bg-slate-100 mt-2">
                                        서식 태그
                                    </div>
                                    <div className="p-2 space-y-1">
                                        {FORMAT_TAGS.map(t => (
                                            <button
                                                key={t.code}
                                                onClick={() => insertCode(t.code)}
                                                className="w-full text-left px-3 py-1.5 rounded border border-slate-200 bg-white hover:border-green-300 hover:bg-green-50 transition-all flex items-center justify-between group"
                                            >
                                                <span className="text-[10px] font-bold text-slate-700 font-mono">{t.code}</span>
                                                <span className="text-[10px] text-slate-400">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-sm">왼쪽 목록에서 양식을 선택하거나 추가해주세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
