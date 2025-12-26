import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import { useWaitingStore } from "@/lib/store/useWaitingStore";
import { Loader2, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface MemberCandidate {
    id: number;
    name: string;
    phone: string;
}

export function QuickRegister() {
    const [inputValue, setInputValue] = useState("");
    const [displayValue, setDisplayValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { fetchWaitingList, currentClassId, fetchClasses, classes, waitingList, closedClasses, closeClass, sequentialClosing } = useWaitingStore();

    const currentClass = classes.find(c => c.id === currentClassId);
    const currentClassWaitingCount = currentClassId && waitingList[currentClassId] ? waitingList[currentClassId].length : 0;
    const currentClassIsClosed = currentClassId ? closedClasses.has(currentClassId) : false;

    const handleCloseClassClick = () => {
        if (!currentClassId || !currentClass) return;

        // Sequential Closing Check
        if (sequentialClosing) {
            const currentNumber = currentClass.class_number;
            const openPrecedingClass = classes.find(c =>
                c.class_number < currentNumber && !closedClasses.has(c.id)
            );

            if (openPrecedingClass) {
                toast.error(`${openPrecedingClass.class_name}가 마감이 되지 않았습니다.`, {
                    description: "이전 교시를 먼저 마감해주세요.",
                    duration: 5000,
                });
                return;
            }
        }

        setCloseDialogOpen(true);
    };

    const handleConfirmClose = async () => {
        if (!currentClassId) return;

        setIsLoading(true);
        try {
            await closeClass(currentClassId);
            toast.success("교시가 마감되었습니다.");
            setCloseDialogOpen(false);
        } catch (e: unknown) {
            const err = e as any;
            toast.error(err.response?.data?.detail || "마감 실패");
        } finally {
            setIsLoading(false);
        }
    };

    // Duplicate Resolution State
    const [candidateDialog, setCandidateDialog] = useState<{ open: boolean, items: MemberCandidate[] }>({ open: false, items: [] });
    // Close Class Confirmation State
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);

    // Format phone number based on input length
    const formatPhoneNumber = (value: string) => {
        // Remove all non-digit characters
        const digitsOnly = value.replace(/\D/g, '');

        // 4자리 이하: 그대로 (기존회원 조회)
        if (digitsOnly.length <= 4) {
            return digitsOnly;
        }

        // 9자리 이상: 그대로 (바코드)
        if (digitsOnly.length >= 9) {
            return digitsOnly;
        }

        // 5-8자리: ####-#### 형식 (신규회원 전화번호)
        if (digitsOnly.length <= 8) {
            const first = digitsOnly.slice(0, 4);
            const second = digitsOnly.slice(4);
            return second ? `${first}-${second}` : first;
        }

        return digitsOnly;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;

        // Allow only digits and hyphens
        const sanitized = rawValue.replace(/[^\d-]/g, '');

        // Remove existing hyphens to get raw digits
        const digitsOnly = sanitized.replace(/-/g, '');

        // Update raw value (digits only)
        setInputValue(digitsOnly);

        // Update display value with formatting
        setDisplayValue(formatPhoneNumber(digitsOnly));
    };

    const handleRegister = async (overrideValue?: string) => {
        const valToSubmit = overrideValue || inputValue;

        if (!valToSubmit.trim()) {
            toast.error("이름, 전화번호 또는 바코드를 입력해주세요.");
            return;
        }

        if (!currentClassId) {
            toast.error("선택된 클래스가 없습니다.");
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                input_value: valToSubmit.trim(),
                class_id: currentClassId,
                person_count: 1 // Default
            };

            const response = await api.post('/members/quick-register', payload);

            // Check for candidates
            if (response.data.candidates && response.data.candidates.length > 0) {
                setCandidateDialog({ open: true, items: response.data.candidates });
                setIsLoading(false);
                return;
            }

            toast.success("대기 접수가 완료되었습니다.");
            setInputValue("");
            setDisplayValue("");

            // Refresh
            fetchClasses();
            fetchWaitingList(currentClassId);

        } catch (error: unknown) {
            const err = error as any;
            console.error(err);
            toast.error(err.response?.data?.detail || "등록 실패");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectCandidate = (candidate: MemberCandidate) => {
        setCandidateDialog({ open: false, items: [] });
        // Retry with full phone number which is unique
        handleRegister(candidate.phone);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRegister();
        }
    };

    return (
        <>
            <div className="flex items-center gap-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
                <div className="flex-1 flex items-center gap-2">
                    <span className="text-muted-foreground whitespace-nowrap min-w-[80px]">간편 등록</span>
                    <div className="flex w-full max-w-md items-center gap-2">
                        <Input
                            placeholder="이름 / 핸드폰번호(8자리) / 바코드"
                            value={displayValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                            className="bg-white text-2xl font-bold tracking-wider"
                        />
                        <Button onClick={() => handleRegister()} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "대기 등록"}
                        </Button>
                    </div>
                </div>

                {/* Batch Actions */}
                {currentClass && (
                    <Button
                        variant="outline"
                        className={currentClassIsClosed
                            ? "text-gray-400 border-gray-200 bg-gray-50"
                            : "text-red-600 border-red-200 hover:bg-red-50"
                        }
                        onClick={handleCloseClassClick}
                        disabled={currentClassIsClosed || isLoading}
                    >
                        {currentClass.class_name} {currentClassIsClosed ? "마감됨" : "마감"} ({currentClassWaitingCount}명)
                    </Button>
                )}
            </div>

            {/* Close Class Confirmation Modal */}
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>교시 마감 확인</DialogTitle>
                        <DialogDescription className="space-y-2 pt-2" asChild>
                            <div>
                                <p><span className="font-bold text-foreground">{currentClass?.class_name}</span>을(를) 정말 마감하시겠습니까?</p>
                                <p className="text-red-500 font-medium">
                                    ※ 대기 중인 <span className="font-bold text-xl">{currentClassWaitingCount}명</span>이 일괄 출석 처리됩니다.
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">마감 후에도 관리자 페이지에서 다시 열 수 있습니다.</p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>취소</Button>
                        <Button variant="destructive" onClick={handleConfirmClose} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            마감하기
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Candidate Selection Modal */}
            <Dialog open={candidateDialog.open} onOpenChange={(open) => setCandidateDialog(prev => ({ ...prev, open }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>중복 회원 선택</DialogTitle>
                        <DialogDescription>
                            검색된 회원이 여러 명입니다. 등록할 회원을 선택해주세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 mt-4 max-h-[60vh] overflow-y-auto">
                        {candidateDialog.items.map((item) => (
                            <Button
                                key={item.id}
                                variant="outline"
                                className="h-auto py-4 justify-start text-left"
                                onClick={() => handleSelectCandidate(item)}
                            >
                                <div className="flex items-center gap-4 w-full">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-lg">{item.name}</div>
                                        <div className="text-muted-foreground">{item.phone}</div>
                                    </div>
                                </div>
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
