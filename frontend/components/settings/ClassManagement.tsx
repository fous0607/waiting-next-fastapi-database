"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, Plus } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

// Schema for Class
const classSchema = z.object({
    id: z.number().optional(),
    class_name: z.string().min(1, "클래스명을 입력하세요"),
    class_number: z.coerce.number().min(1, "순서를 입력하세요"),
    start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM 형식이어야 합니다"),
    end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "HH:MM 형식이어야 합니다"),
    max_capacity: z.coerce.number().min(1, "최대 인원을 입력하세요"),
    is_weekend: z.boolean().default(false),
    class_type: z.enum(['weekday', 'weekend', 'holiday']).default('weekday'),
});

const addMinutes = (time: string, minutes: number) => {
    if (!time) return "09:00";
    const [h, m] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minutes);
    return date.toTimeString().slice(0, 5);
};

type ClassFormValues = z.infer<typeof classSchema>;

interface ClassItem {
    id: number;
    class_name: string;
    class_number: number;
    start_time: string;
    end_time: string;
    max_capacity: number;
    class_type: 'weekday' | 'weekend' | 'holiday';
}

export function ClassManagement() {
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState("weekday");
    const [holidays, setHolidays] = useState<{ id?: number; date: string; name: string }[]>([]);

    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
    const [newHolidayDate, setNewHolidayDate] = useState(new Date().toISOString().split('T')[0]);
    const [newHolidayName, setNewHolidayName] = useState("공휴일");
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM format
    const [importYear, setImportYear] = useState<number>(new Date().getFullYear());
    const [isImporting, setIsImporting] = useState(false);
    const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);
    const [defaultClassMinute, setDefaultClassMinute] = useState<number | string>(50);
    const [defaultBreakMinute, setDefaultBreakMinute] = useState<number | string>(10);
    const [defaultMaxCapacity, setDefaultMaxCapacity] = useState<number | string>(10);

    const form = useForm<ClassFormValues>({
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        resolver: zodResolver(classSchema) as any,
        defaultValues: {
            class_name: "",
            class_number: 1,
            start_time: "09:00",
            end_time: "10:00",
            max_capacity: 10,
            class_type: 'weekday',
            is_weekend: false,
        },
    });

    const fetchClasses = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get(`/classes/?class_type=${activeTab}`);
            setClasses(data);
        } catch (error) {
            console.error("Failed to fetch classes", error);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab]);

    const fetchHolidays = useCallback(async () => {
        try {
            const { data } = await api.get('/holidays/');
            setHolidays(data);
        } catch (error) {
            console.error("Failed to fetch holidays", error);
        }
    }, []);

    // Generate month options (current year and next year)
    const monthOptions = useMemo(() => {
        const options = [];
        const currentDate = new Date();

        // Previous 6 months, current month, next 12 months
        for (let i = -6; i <= 12; i++) {
            const date = new Date(currentDate);
            date.setMonth(currentDate.getMonth() + i);
            const yearMonth = date.toISOString().slice(0, 7);
            const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
            options.push({ value: yearMonth, label });
        }
        return options;
    }, []);

    // Filter holidays by selected month
    const filteredHolidays = useMemo(() => {
        if (!selectedMonth) return holidays;
        return holidays.filter(h => h.date.startsWith(selectedMonth));
    }, [holidays, selectedMonth]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/store');
                if (data.default_class_minute) setDefaultClassMinute(data.default_class_minute);
                if (data.default_break_minute) setDefaultBreakMinute(data.default_break_minute);
                if (data.default_max_capacity) setDefaultMaxCapacity(data.default_max_capacity);
            } catch (error) {
                console.error("Failed to fetch settings", error);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        if (activeTab === 'holiday') {
            fetchHolidays();
        }
        fetchClasses();
    }, [activeTab, fetchClasses, fetchHolidays]);

    const handleSaveTimeSettings = async () => {
        try {
            await api.put('/store', {
                default_class_minute: Number(defaultClassMinute) || 0,
                default_break_minute: Number(defaultBreakMinute) || 0,
                default_max_capacity: Number(defaultMaxCapacity) || 0
            });
            toast.success("설정이 저장되었습니다.");
        } catch (error) {
            console.error(error);
            toast.error("설정 저장 실패");
        }
    };

    const handleAdd = () => {
        setEditMode(false);

        let nextStart = "09:00";
        let nextEnd = addMinutes("09:00", Number(defaultClassMinute) || 50);

        if (classes.length > 0) {
            const sorted = [...classes].sort((a, b) => a.class_number - b.class_number);
            const last = sorted[sorted.length - 1];
            nextStart = addMinutes(last.end_time, Number(defaultBreakMinute) || 10);
            nextEnd = addMinutes(nextStart, Number(defaultClassMinute) || 50);
        }

        form.reset({
            class_name: "",
            class_number: classes.length + 1,
            start_time: nextStart,
            end_time: nextEnd,
            max_capacity: Number(defaultMaxCapacity) || 10,
            class_type: activeTab as any,
        });
        setIsModalOpen(true);
    };

    const handleEdit = (item: ClassItem) => {
        setEditMode(true);
        form.reset({
            id: item.id,
            class_name: item.class_name,
            class_number: item.class_number,
            start_time: item.start_time.substring(0, 5),
            end_time: item.end_time.substring(0, 5),
            max_capacity: item.max_capacity,
            class_type: item.class_type,
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/classes/${id}`);
            toast.success("삭제되었습니다.");
            fetchClasses();
        } catch (error) {
            toast.error("삭제 실패");
        }
    };

    const handleAddHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/holidays/', { date: newHolidayDate, name: newHolidayName });
            toast.success("공휴일이 등록되었습니다.");
            setIsHolidayModalOpen(false);
            fetchHolidays();
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        } catch (error: any) {
            console.error(error);
            toast.error('설정 저장에 실패했습니다.');
        }
    };

    const handleDeleteHoliday = async (dateStr: string) => {
        if (!confirm(`${dateStr}을(를) 공휴일에서 제외하시겠습니까?`)) return;
        try {
            await api.delete(`/holidays/${dateStr}`);
            toast.success("공휴일이 삭제되었습니다.");
            fetchHolidays();
        } catch (error) {
            toast.error("삭제 실패");
        }
    };

    const handleImportHolidays = () => {
        setIsImportAlertOpen(true);
    };

    const confirmImportHolidays = async () => {
        setIsImporting(true);
        try {
            const { data } = await api.post(`/holidays/import/${importYear}`);
            toast.success(data.message);
            fetchHolidays();
        } catch (error: any) {
            console.error(error);
            const errorMsg = error.response?.data?.detail || '공휴일 불러오기에 실패했습니다.';
            toast.error(errorMsg);
        } finally {
            setIsImporting(false);
            setIsImportAlertOpen(false);
        }
    };

    const onSubmit = async (data: ClassFormValues) => {
        try {
            if (editMode && data.id) {
                await api.put(`/classes/${data.id}`, data);
                toast.success("수정되었습니다.");
            } else {
                await api.post("/classes/", data);
                toast.success("추가되었습니다.");
            }
            setIsModalOpen(false);
            fetchClasses();
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        } catch (error: any) {
            console.error(error);
            toast.error("저장 실패");
        }
    };

    return (
        <div className="flex gap-6 min-h-[600px]">
            {/* Left Sidebar */}
            <div className="w-48 shrink-0 space-y-2">
                <div className="font-semibold text-lg px-2 mb-4 text-muted-foreground">
                    클래스/일정 목록
                </div>
                <div className="space-y-1">
                    <Button
                        variant={activeTab === 'weekday' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-10"
                        onClick={() => setActiveTab('weekday')}
                    >
                        <span className="mr-2">📅</span> 평일 클래스
                    </Button>
                    <Button
                        variant={activeTab === 'weekend' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-10"
                        onClick={() => setActiveTab('weekend')}
                    >
                        <span className="mr-2">🏖️</span> 주말 클래스
                    </Button>
                    <Button
                        variant={activeTab === 'holiday' ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left h-10"
                        onClick={() => setActiveTab('holiday')}
                    >
                        <span className="mr-2">🎉</span> 공휴일 관리
                    </Button>
                </div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            {activeTab === 'weekday' && '평일 클래스 관리'}
                            {activeTab === 'weekend' && '주말 클래스 관리'}
                            {activeTab === 'holiday' && '공휴일 일정 관리'}
                        </h2>
                    </div>
                </div>

                {activeTab === 'holiday' && (
                    <Card className="mb-6">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex-1">
                                <CardTitle>공휴일 목록</CardTitle>
                                <CardDescription>특정 날짜를 공휴일로 지정하여 클래스 일정을 조정합니다.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select value={String(importYear)} onValueChange={(v) => setImportYear(Number(v))}>
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[2024, 2025, 2026, 2027].map(y => (
                                            <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={handleImportHolidays}
                                    variant="secondary"
                                    disabled={isImporting}
                                    size="sm"
                                >
                                    {isImporting ? "불러오는 중..." : "공휴일 불러오기"}
                                </Button>
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue placeholder="월 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button onClick={() => setIsHolidayModalOpen(true)} variant="outline">
                                    <Plus className="w-4 h-4 mr-2" />
                                    공휴일 추가
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>날짜</TableHead>
                                        <TableHead>이름</TableHead>
                                        <TableHead className="text-right">관리</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredHolidays.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                                                {selectedMonth ? `${selectedMonth.split('-')[0]}년 ${parseInt(selectedMonth.split('-')[1])}월에 등록된 공휴일이 없습니다.` : '등록된 공휴일이 없습니다.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredHolidays
                                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                            .map((h) => (
                                                <TableRow key={h.date}>
                                                    <TableCell>{h.date}</TableCell>
                                                    <TableCell>{h.name}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(h.date)}>
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Default Class Time Settings */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>수업 시간 기본 설정</CardTitle>
                        <CardDescription>클래스 추가 시 자동으로 계산될 수업 시간과 쉬는 시간을 설정합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-4">
                            <div className="space-y-2">
                                <Label>수업 시간 (분)</Label>
                                <Input
                                    type="number"
                                    value={defaultClassMinute}
                                    onChange={(e) => setDefaultClassMinute(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-32"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>쉬는 시간 (분)</Label>
                                <Input
                                    type="number"
                                    value={defaultBreakMinute}
                                    onChange={(e) => setDefaultBreakMinute(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-32"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>기본 정원 (명)</Label>
                                <Input
                                    type="number"
                                    value={defaultMaxCapacity}
                                    onChange={(e) => setDefaultMaxCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-32"
                                />
                            </div>
                            <Button onClick={handleSaveTimeSettings}>저장</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Class List Section - Always visible, but filtered by activeTab via API fetch */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">
                            {activeTab === 'holiday' ? '공휴일 운영 클래스' : '클래스 목록'}
                        </h3>
                        <Button onClick={handleAdd}>
                            <Plus className="w-4 h-4 mr-2" />
                            클래스 추가
                        </Button>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60px]">순서</TableHead>
                                        <TableHead>클래스명</TableHead>
                                        <TableHead>시간</TableHead>
                                        <TableHead className="text-right">인원</TableHead>
                                        <TableHead className="text-right">관리</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12">
                                                <div className="flex justify-center items-center gap-2">
                                                    <span className="animate-spin text-xl">⏳</span> 로딩 중...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : classes.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                {activeTab === 'holiday'
                                                    ? '등록된 공휴일 클래스가 없습니다.'
                                                    : '등록된 클래스가 없습니다.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        classes.map((cls) => (
                                            <TableRow key={cls.id}>
                                                <TableCell>{cls.class_number}</TableCell>
                                                <TableCell className="font-medium text-base">{cls.class_name}</TableCell>
                                                <TableCell>
                                                    <span className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                                        {cls.start_time} - {cls.end_time}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">{cls.max_capacity}명</TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(cls)}>
                                                        <Edit className="w-4 h-4 text-blue-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cls.id)}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editMode ? "클래스 수정" : "클래스 추가"}</DialogTitle>
                        <DialogDescription>
                            {activeTab === 'weekday' ? '평일' : activeTab === 'weekend' ? '주말' : '공휴일'} 운영 클래스 정보를 입력하세요.
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="class_name"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel>클래스명</FormLabel>
                                            <FormControl>
                                                <Input placeholder="예: 1교시 (오전)" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="class_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>표시 순서</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="max_capacity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>정원</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="start_time"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>시작 시간</FormLabel>
                                            <FormControl>
                                                <Input type="time" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="end_time"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>종료 시간</FormLabel>
                                            <FormControl>
                                                <Input type="time" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit">{editMode ? "수정" : "추가"}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={isHolidayModalOpen} onOpenChange={setIsHolidayModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>공휴일 추가</DialogTitle>
                        <DialogDescription>
                            공휴일로 지정할 날짜를 선택하세요.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddHoliday} className="space-y-4">
                        <div className="space-y-2">
                            <Label>날짜</Label>
                            {/* ... existing inputs ... */}
                            <Input
                                type="date"
                                required
                                value={newHolidayDate}
                                onChange={(e) => setNewHolidayDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>이름</Label>
                            <Input
                                type="text"
                                placeholder="예: 크리스마스"
                                value={newHolidayName}
                                onChange={(e) => setNewHolidayName(e.target.value)}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit">추가</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{importYear}년 공휴일 불러오기</AlertDialogTitle>
                        <AlertDialogDescription>
                            공공데이터포털에서 {importYear}년 공휴일 정보를 불러옵니다.<br />
                            이미 등록된 공휴일은 제외하고 새로운 공휴일만 추가됩니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmImportHolidays}>
                            {isImporting ? "불러오는 중..." : "확인"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
