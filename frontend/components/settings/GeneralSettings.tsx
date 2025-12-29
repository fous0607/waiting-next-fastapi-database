"use client";
import QRCode from 'react-qr-code';

import { useEffect, useState } from 'react';
import { QRPrintModal } from './QRPrintModal';
import { Loader2, Copy, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from 'sonner';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// Comprehensive Schema matching Backend StoreSettings
const settingsSchema = z.object({
    store_name: z.string().min(1, '매장명을 입력해주세요.'),
    theme: z.enum(['zinc', 'blue', 'green', 'orange']).optional(),

    // Display Config
    display_classes_count: z.coerce.number().min(1),
    rows_per_class: z.coerce.number().min(1),
    list_direction: z.enum(['vertical', 'horizontal']).default('vertical'),

    // Business Logic
    business_day_start: z.coerce.number().min(0).max(23).default(7),
    daily_opening_rule: z.enum(['strict', 'flexible']).default('strict'),
    auto_closing: z.boolean().default(true),
    closing_action: z.enum(['reset', 'attended']).default('reset'),

    // Limits & Rules
    use_max_waiting_limit: z.boolean().default(true),
    max_waiting_limit: z.coerce.number().min(0).default(50),
    block_last_class_registration: z.boolean().default(false),
    auto_register_member: z.boolean().default(false),
    require_member_registration: z.boolean().default(false),

    // Revisit Badge (New)
    enable_revisit_badge: z.boolean().default(false),
    revisit_period_days: z.coerce.number().min(0).default(0), // 0 = all time
    revisit_badge_style: z.string().default("indigo_solid"),

    // Attendance
    attendance_count_type: z.enum(['days', 'monthly']).default('days'),
    attendance_lookback_days: z.coerce.number().min(1).default(30),

    // Waiting Board Display
    show_waiting_number: z.boolean().default(true),
    mask_customer_name: z.boolean().default(false),
    name_display_length: z.coerce.number().min(0).default(0),
    show_order_number: z.boolean().default(true),
    board_display_order: z.string().default("number,name,order"),
    waiting_board_page_size: z.coerce.number().min(1).default(12),
    waiting_board_rotation_interval: z.coerce.number().min(3).default(5),
    waiting_board_transition_effect: z.string().optional(),

    // Fonts & sizes
    manager_font_family: z.string().default("Nanum Gothic"),
    manager_font_size: z.string().default("15px"),
    board_font_family: z.string().default("Nanum Gothic"),
    board_font_size: z.string().default("24px"),

    manager_button_size: z.enum(['xsmall', 'small', 'medium', 'large']).default('medium'),
    waiting_list_box_size: z.enum(['small', 'medium', 'large']).default('medium'),
    waiting_manager_max_width: z.coerce.number().optional().nullable(),

    keypad_style: z.string().default("modern"),
    keypad_font_size: z.string().default("large"),
    keypad_sound_enabled: z.boolean().default(true),
    keypad_sound_type: z.enum(['button', 'soft', 'atm', 'elevator', 'touch', 'classic_beep']).default('button'),

    // Modal & Audio
    waiting_modal_timeout: z.coerce.number().min(1).default(5),
    show_member_name_in_waiting_modal: z.boolean().default(true),
    show_new_member_text_in_waiting_modal: z.boolean().default(true),
    enable_waiting_voice_alert: z.boolean().default(false),
    waiting_voice_message: z.string().optional().nullable(),
    waiting_call_voice_message: z.string().optional().nullable(),

    // Voice Selection (Legacy fields were rate, pitch, name - keep them but map UI)
    waiting_voice_name: z.string().optional().nullable(),
    waiting_voice_rate: z.coerce.number().min(0.1).max(2.0).default(1.0),
    waiting_voice_pitch: z.coerce.number().min(0).max(2).default(1.0),
    waiting_call_voice_repeat_count: z.coerce.number().min(1).max(5).default(1),

    // Traffic
    enable_waiting_board: z.boolean().default(true),
    enable_reception_desk: z.boolean().default(true),
    max_dashboard_connections: z.coerce.number().min(1).max(10).default(2),
    dashboard_connection_policy: z.enum(['eject_old', 'block_new']).default('eject_old'),

    sequential_closing: z.boolean().default(false),

    admin_password: z.string().optional(), // For verification if needed, usually just loaded
    registration_message: z.string().default("처음 방문하셨네요!\n성함을 입력해 주세요."),


});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function GeneralSettings() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    const form = useForm<SettingsFormValues>({
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        resolver: zodResolver(settingsSchema) as any,
        defaultValues: {
            store_name: '',
            theme: 'zinc',
            display_classes_count: 3,
            rows_per_class: 1,
            list_direction: 'vertical',
            business_day_start: 7,
            daily_opening_rule: 'strict',
            auto_closing: true,
            closing_action: 'reset',
            use_max_waiting_limit: true,
            max_waiting_limit: 50,
            block_last_class_registration: false,
            auto_register_member: false,
            require_member_registration: false,
            enable_revisit_badge: false,
            revisit_period_days: 0,
            revisit_badge_style: "indigo_solid",
            attendance_count_type: 'days',
            attendance_lookback_days: 30,
            show_waiting_number: true,
            mask_customer_name: false,
            name_display_length: 0,
            show_order_number: true,
            board_display_order: "number,name,order",
            waiting_board_page_size: 12,
            waiting_board_rotation_interval: 5,
            manager_font_family: "Nanum Gothic",
            manager_font_size: "15px",
            board_font_family: "Nanum Gothic",
            board_font_size: "24px",
            manager_button_size: 'medium',
            waiting_list_box_size: 'medium',
            waiting_manager_max_width: null,
            keypad_style: "modern",
            keypad_font_size: "large",
            keypad_sound_enabled: true,
            keypad_sound_type: "button",
            waiting_modal_timeout: 5,
            show_member_name_in_waiting_modal: true,
            show_new_member_text_in_waiting_modal: true,
            enable_waiting_voice_alert: false,
            enable_waiting_board: true,
            enable_reception_desk: true,
            max_dashboard_connections: 2,
            dashboard_connection_policy: 'eject_old',
            sequential_closing: false,
            registration_message: "처음 방문하셨네요!\n성함을 입력해 주세요.",
        },
    });

    const [storeCode, setStoreCode] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopyUrl = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setIsCopied(true);
            toast.success('URL이 클립보드에 복사되었습니다.');
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            toast.error('URL 복사에 실패했습니다.');
        }
    };

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            // Filter only Korean voices by default or just show all if desired
            // Let's show Korean primarily
            const koVoices = availableVoices.filter(v => v.lang.includes('ko'));
            setVoices(koVoices.length > 0 ? koVoices : availableVoices);
        };

        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/store/');
                // Map backend response to form values
                // Ensure null values are replaced with defaults for required numeric fields

                // Store Code Handling
                if (data.store_code) {
                    setStoreCode(data.store_code);
                    localStorage.setItem('store_code', data.store_code);
                }

                form.reset({
                    ...data,
                    display_classes_count: data.display_classes_count || 3,
                    rows_per_class: data.rows_per_class || 1,
                    waiting_board_page_size: data.waiting_board_page_size || 12,
                    waiting_board_rotation_interval: data.waiting_board_rotation_interval || 5,
                    business_day_start: data.business_day_start ?? 7,
                    waiting_manager_max_width: data.waiting_manager_max_width || null,
                    manager_button_size: data.manager_button_size || 'medium',
                    waiting_list_box_size: data.waiting_list_box_size || 'medium',

                    // Prevent uncontrolled to controlled warnings for all checkboxes
                    auto_register_member: data.auto_register_member ?? false,
                    require_member_registration: data.require_member_registration ?? false,
                    enable_revisit_badge: data.enable_revisit_badge ?? false,
                    revisit_period_days: data.revisit_period_days ?? 0,
                    revisit_badge_style: data.revisit_badge_style ?? "indigo_solid",
                    show_member_name_in_waiting_modal: data.show_member_name_in_waiting_modal ?? true,
                    show_new_member_text_in_waiting_modal: data.show_new_member_text_in_waiting_modal ?? true,
                    enable_waiting_voice_alert: data.enable_waiting_voice_alert ?? false,
                    enable_waiting_board: data.enable_waiting_board ?? true,
                    enable_reception_desk: data.enable_reception_desk ?? true,
                    max_dashboard_connections: data.max_dashboard_connections || 2,
                    dashboard_connection_policy: data.dashboard_connection_policy || 'eject_old',
                    auto_closing: data.auto_closing ?? true,
                    use_max_waiting_limit: data.use_max_waiting_limit ?? true,
                    block_last_class_registration: data.block_last_class_registration ?? false,
                    sequential_closing: data.sequential_closing ?? false,
                    show_waiting_number: data.show_waiting_number ?? true,
                    mask_customer_name: data.mask_customer_name ?? false,
                    show_order_number: data.show_order_number ?? true,
                    registration_message: data.registration_message || "처음 방문하셨네요!\n성함을 입력해 주세요.",
                });

                // Set initial theme
                const theme = data.theme || 'zinc';
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);
            } catch (error) {
                console.error(error);
                if ((error as any).response?.status === 401) {
                    router.push('/login');
                } else {
                    toast.error('설정을 불러오는데 실패했습니다.');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, [form, router]);

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const onSubmit = async (data: SettingsFormValues) => {
        console.log("Form submitting with data:", data); // Debug log
        try {
            await api.put('/store/', data);
            toast.success('설정이 저장되었습니다.');
            document.documentElement.setAttribute('data-theme', data.theme || 'zinc');
            localStorage.setItem('theme', data.theme || 'zinc');
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        } catch (error: any) {
            console.error("Submit error:", error);
            toast.error('설정 저장에 실패했습니다.');
        }
    };

    const onError = (errors: any) => {
        console.error("Form validation errors:", errors);
        // Extract error messages and show the first one
        const firstErrorKey = Object.keys(errors)[0];
        const errorMessage = errors[firstErrorKey]?.message || "입력값을 확인해주세요.";
        toast.error(`설정 저장 실패: ${errorMessage} `);
    };

    // Verify render and form state
    console.log("GeneralSettings Rendered. Loading:", isLoading);
    console.log("Current Form Errors:", form.formState.errors);
    console.log("Current Form Values:", form.getValues());

    if (isLoading) {
        return <div className="p-8 flex justify-center">로딩 중...</div>;
    }

    const handlePreviewVoice = () => {
        const values = form.getValues();
        if (!window.speechSynthesis) {
            toast.error('이 브라우저는 음성 안내를 지원하지 않습니다.');
            return;
        }

        window.speechSynthesis.cancel();
        const text = values.waiting_voice_message?.replace('{클래스명}', '테스트교시').replace('{회원명}', '홍길동').replace('{순번}', '1')
            || '테스트교시 홍길동님 1번째 대기 접수 되었습니다.';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = values.waiting_voice_rate || 1.0;
        utterance.pitch = values.waiting_voice_pitch || 1.0;

        if (values.waiting_voice_name) {
            const voice = voices.find(v => v.name === values.waiting_voice_name);
            if (voice) utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={(e) => {
                    console.log("Form submit event triggered");
                    form.handleSubmit(onSubmit, onError)(e);
                }}
                className="space-y-6"
            >

                {/* Section 1: Basic Information */}
                <div className="space-y-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="store_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>매장명</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="theme"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>테마</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="테마 선택" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="zinc">Zinc (Gray)</SelectItem>
                                            <SelectItem value="blue">Blue</SelectItem>
                                            <SelectItem value="green">Green</SelectItem>
                                            <SelectItem value="orange">Orange</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    {/* Section: Waiting Management (New) */}
                    <AccordionItem value="waiting-management">
                        <AccordionTrigger>대기자 관리 (재방문/배지)</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="enable_revisit_badge"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">대기자 재방문 배지 사용</FormLabel>
                                                <FormDescription>
                                                    대기자 카드 우측 상단에 "재방문 N" 배지를 표시합니다.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                {form.watch('enable_revisit_badge') && (
                                    <FormField
                                        control={form.control}
                                        name="revisit_period_days"
                                        render={({ field }) => (
                                            <FormItem className="rounded-lg border p-4">
                                                <FormLabel>재방문 카운트 기간 설정 (일)</FormLabel>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <div className="flex-1">
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                {...field}
                                                                disabled={field.value === 0}
                                                                className={field.value === 0 ? "bg-slate-100" : ""}
                                                            />
                                                        </FormControl>
                                                    </div>
                                                    <div className="flex items-center space-x-2 min-w-[120px]">
                                                        <Checkbox
                                                            id="revisit_all_time"
                                                            checked={field.value === 0}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    field.onChange(0);
                                                                } else {
                                                                    field.onChange(365); // Default to 1 year if unchecked
                                                                }
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor="revisit_all_time"
                                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                        >
                                                            전체 기간
                                                        </label>
                                                    </div>
                                                </div>
                                                <FormDescription>
                                                    0일 또는 '전체 기간' 선택 시 모든 방문 기록을 카운트합니다. <br />
                                                    (예: 30 입력 시 최근 30일간의 방문 횟수만 표시)
                                                </FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                )}
                                {form.watch('enable_revisit_badge') && (
                                    <div className="md:col-span-2 space-y-4 pt-4 border-t">
                                        <FormField
                                            control={form.control}
                                            name="revisit_badge_style"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel className="text-sm font-semibold">재방문 배지 스타일 선택</FormLabel>
                                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                                        {[
                                                            { id: 'indigo_solid', name: '스탠다드', class: 'bg-indigo-600 text-white rounded-full' },
                                                            { id: 'amber_outline', name: '골드라인', class: 'border-2 border-amber-400 text-amber-600 rounded-lg bg-amber-50' },
                                                            { id: 'emerald_pill', name: '에메랄드', class: 'bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 font-bold' },
                                                            { id: 'rose_gradient', name: '로즈그라데이션', class: 'bg-gradient-to-r from-rose-400 to-pink-500 text-white rounded-md shadow-sm' },
                                                            { id: 'sky_glass', name: '블루글래스', class: 'bg-sky-400/20 text-sky-700 backdrop-blur-sm border border-sky-300 rounded-full' }
                                                        ].map((style) => (
                                                            <div
                                                                key={style.id}
                                                                className={cn(
                                                                    "relative p-3 rounded-xl border-2 cursor-pointer transition-all hover:border-primary/50 flex flex-col items-center justify-center gap-2",
                                                                    field.value === style.id ? "border-primary bg-primary/5 shadow-sm" : "border-slate-100 bg-white"
                                                                )}
                                                                onClick={() => field.onChange(style.id)}
                                                            >
                                                                <div className={cn("px-2 py-0.5 text-[10px] whitespace-nowrap", style.class)}>
                                                                    재방문 2
                                                                </div>
                                                                <span className="text-[11px] font-medium text-slate-600">{style.name}</span>
                                                                {field.value === style.id && (
                                                                    <div className="absolute top-1 right-1">
                                                                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                                                            <Check className="w-2.5 h-2.5 text-white" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Section: QR Code / Mobile Entry (New) */}
                    <AccordionItem value="qr-code">
                        <AccordionTrigger>모바일 / QR 코드 대기접수</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                            <div className="rounded-lg border p-4 bg-slate-50">
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row items-center gap-6">
                                        <div className="p-4 bg-white rounded-xl shadow-sm border">
                                            {/* QR Code Rendering */}
                                            {(() => {
                                                // Calculate URL safely on client side
                                                if (typeof window === 'undefined' || !storeCode) return <div className="p-4 text-xs text-muted-foreground">매장 코드를 로딩중입니다...</div>;
                                                const origin = window.location.origin;
                                                const entryUrl = `${origin} /entry/${storeCode} `;

                                                return (
                                                    <div className="space-y-2 text-center">
                                                        <QRCode value={entryUrl} size={150} />
                                                        <div className="text-[10px] text-slate-400 mt-2">스캔하여 대기 접수</div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        <div className="space-y-2 flex-1">
                                            <h4 className="text-sm font-medium">공용 대기접수 QR 코드</h4>
                                            <p className="text-xs text-muted-foreground break-keep">
                                                이 QR 코드를 인쇄하여 매장 입구나 카운터에 비치해주세요. <br />
                                                고객이 별도의 앱 설치 없이 휴대폰 카메라로 스캔하여 바로 대기를 접수할 수 있습니다.
                                            </p>

                                            <div className="pt-2 flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        if (!storeCode) return;
                                                        window.open(`/ entry / ${storeCode} `, '_blank');
                                                    }}
                                                    disabled={!storeCode}
                                                >
                                                    페이지 열기
                                                </Button>
                                                <QRPrintModal
                                                    storeName={form.watch('store_name')}
                                                    storeCode={storeCode || ''}
                                                />
                                            </div>
                                            <div className="pt-1 flex items-center gap-2">
                                                <div className="bg-slate-100 p-1 px-2 rounded flex items-center gap-2 border">
                                                    <p className="text-[10px] text-slate-500 font-mono">
                                                        URL: {typeof window !== 'undefined' && storeCode ? `${window.location.origin} /entry/${storeCode} ` : 'Loading...'}
                                                    </p>
                                                    {typeof window !== 'undefined' && storeCode && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleCopyUrl(`${window.location.origin} /entry/${storeCode} `);
                                                            }}
                                                            className="text-slate-400 hover:text-slate-600 transition-colors"
                                                            title="복사하기"
                                                        >
                                                            {isCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Section 2: Display Configuration */}
                    <AccordionItem value="display">
                        <AccordionTrigger>화면 표시 설정 (현황판/사이즈)</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="display_classes_count"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>현황판 표시 클래스 수</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="rows_per_class"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>클래스 당 줄 수</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="list_direction"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>대기자 리스트 방향</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="vertical">세로 방향</SelectItem>
                                                    <SelectItem value="horizontal">가로 방향</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="manager_button_size"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>대기관리자 버튼 크기</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="xsmall">더 작게</SelectItem>
                                                    <SelectItem value="small">작게</SelectItem>
                                                    <SelectItem value="medium">중간 (기본)</SelectItem>
                                                    <SelectItem value="large">크게</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <h4 className="font-medium mt-4 mb-2 text-sm text-gray-500">대기현황판 페이지네이션 (자동 회전)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <FormField
                                    control={form.control}
                                    name="waiting_board_page_size"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>페이지 당 표시 개수</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                            <FormDescription>한 화면에 표시할 대기자 수</FormDescription>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="waiting_board_rotation_interval"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>페이지 회전 간격 (초)</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                            <FormDescription>페이지가 자동 전환되는 시간 간격</FormDescription>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="waiting_board_transition_effect"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>페이지 전환 효과</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="효과 선택" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="slide">슬라이드 (기본)</SelectItem>
                                                    <SelectItem value="fade">페이드</SelectItem>
                                                    <SelectItem value="scale">스케일</SelectItem>
                                                    <SelectItem value="none">없음</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                현황판 페이지 전환 시 적용할 애니메이션
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="board_font_family"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>현황판 폰트</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Nanum Gothic">나눔고딕</SelectItem>
                                                    <SelectItem value="Gowun Dodum">고운돋움</SelectItem>
                                                    <SelectItem value="Noto Sans KR">Noto Sans</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="board_font_size"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>현황판 글자 크기</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="20px">20px (작음)</SelectItem>
                                                    <SelectItem value="24px">24px (보통)</SelectItem>
                                                    <SelectItem value="32px">32px (큼)</SelectItem>
                                                    <SelectItem value="40px">40px (매우 큼)</SelectItem>
                                                    <SelectItem value="50px">50px (매우 매우 큼)</SelectItem>
                                                    <SelectItem value="60px">60px (초대형 1)</SelectItem>
                                                    <SelectItem value="70px">70px (초대형 2)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Section 3: Operation Rules */}
                    <AccordionItem value="rules">
                        <AccordionTrigger>운영 규칙 (영업시간/마감/규칙)</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="business_day_start"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>영업 시작 기준 (새벽 시간)</FormLabel>
                                            <FormControl><Input type="number" min={0} max={23} {...field} /></FormControl>
                                            <FormDescription>예: 5 = 05:00. 이 시간 이전 접수는 전날로 기록.</FormDescription>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="daily_opening_rule"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>개점 설정</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="strict">1일 1회만 개점 (엄격)</SelectItem>
                                                    <SelectItem value="flexible">자동 날짜 변경 (유연)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="use_max_waiting_limit"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">최대 대기 인원 제한</FormLabel>
                                                <FormDescription>
                                                    전체 대기 인원이 일정 수를 넘으면 접수를 차단합니다.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                {form.watch('use_max_waiting_limit') && (
                                    <FormField
                                        control={form.control}
                                        name="max_waiting_limit"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>최대 대기 허용 인원</FormLabel>
                                                <FormControl>
                                                    <Input type="number" min={0} {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    이 인원수만큼 대기가 차면 더 이상 접수를 받지 않습니다.
                                                </FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                            <div className="flex gap-4">
                                <FormField
                                    control={form.control}
                                    name="auto_closing"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-2 space-y-0 p-2">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal'>자동 마감 및 리셋 사용</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="block_last_class_registration"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-2 space-y-0 p-2">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal'>마지막 교시 정원초과 시 차단</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sequential_closing"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-2 space-y-0 p-2">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal'>순차적 마감 사용</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Section 4: Modal & Reception */}
                    <AccordionItem value="reception">
                        <AccordionTrigger>대기접수 및 알림 설정 (v2.0)</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="waiting_modal_timeout"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>접수완료 모달 시간 (초)</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="keypad_style"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>키패드 스타일</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="modern">Modern</SelectItem>
                                                    <SelectItem value="bold">Bold (어르신 추천)</SelectItem>
                                                    <SelectItem value="dark">Dark</SelectItem>
                                                    <SelectItem value="colorful">Colorful</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="keypad_sound_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>키패드 효과음 종류</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value as string || ''}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="button">Button (현대적 클릭음)</SelectItem>
                                                    <SelectItem value="soft">Soft (부드러운 버튼음)</SelectItem>
                                                    <SelectItem value="atm">ATM (전화기 스타일)</SelectItem>
                                                    <SelectItem value="elevator">Elevator (엘리베이터 버튼)</SelectItem>
                                                    <SelectItem value="touch">Touch (터치스크린)</SelectItem>
                                                    <SelectItem value="classic_beep">Classic Beep (전통적인 삐 소리)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs">
                                                각 키마다 다른 소리로 실제 키보드 타이핑 느낌을 제공합니다
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormField
                                    control={form.control}
                                    name="keypad_sound_enabled"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal'>키패드 효과음 사용</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="show_member_name_in_waiting_modal"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal'>완료 모달에 회원 이름 표시</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="show_new_member_text_in_waiting_modal"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal'>완료 모달에 신규회원 안내 문구 표시</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="enable_waiting_voice_alert"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal'>음성 안내 사용</FormLabel>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="waiting_voice_message"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>접수 완료 안내 메시지</FormLabel>
                                            <FormControl><Input placeholder="예: {클래스명}  {회원명}님 대기 접수 되었습니다." {...field} value={field.value ?? ''} /></FormControl>
                                            <FormDescription className="text-[10px]">
                                                {`{ 클래스명 }, { 회원명 }, { 순번 }을 사용할 수 있습니다.공백을 2번 연속 입력하면 0.5초간 쉬고 읽어줍니다.`}
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="waiting_call_voice_message"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>호출 시 안내 메시지</FormLabel>
                                            <FormControl><Input placeholder="예: {순번}번 {회원명}님, 데스크로 오시기 바랍니다." {...field} value={field.value ?? ''} /></FormControl>
                                            <FormDescription className="text-[10px]">
                                                {`{ 회원명 }, { 순번 }을 사용할 수 있습니다. (대기현황판 전용)`}
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />

                                {form.watch('enable_waiting_voice_alert') && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                        <FormField
                                            control={form.control}
                                            name="waiting_voice_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">목소리 선택 (성별/유형)</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-9 text-xs">
                                                                <SelectValue placeholder="목소리를 선택하세요" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {voices.length === 0 && <SelectItem value="default">시스템 기본값</SelectItem>}
                                                            {voices.map((voice) => (
                                                                <SelectItem key={voice.name} value={voice.name} className="text-xs">
                                                                    {voice.name.includes('Female') || voice.name.includes('Yuna') || voice.name.includes('Jiyoung') || voice.name.includes('Soyeon') ? ' [여성] ' : (voice.name.includes('Male') || voice.name.includes('Minsang') ? ' [남성] ' : ' [공공/기타] ')} {voice.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="waiting_voice_rate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">말하기 속도</FormLabel>
                                                    <Select onValueChange={(val) => field.onChange(parseFloat(val))} value={field.value?.toString()}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-9 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="0.7">느리게 (0.7x)</SelectItem>
                                                            <SelectItem value="0.8">조금 느리게 (0.8x)</SelectItem>
                                                            <SelectItem value="1.0">보통 (1.0x)</SelectItem>
                                                            <SelectItem value="1.2">조금 빠르게 (1.2x)</SelectItem>
                                                            <SelectItem value="1.5">빠르게 (1.5x)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="waiting_call_voice_repeat_count"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">호출 방송 반복 횟수</FormLabel>
                                                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString() || "1"}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-9 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {[1, 2, 3, 4, 5].map(num => (
                                                                <SelectItem key={num} value={num.toString()} className="text-xs">{num}회</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                        <div className="md:col-span-2 flex justify-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-8"
                                                onClick={handlePreviewVoice}
                                            >
                                                미리듣기 (Preview)
                                            </Button>
                                        </div>
                                    </div>
                                )}
                                <FormField
                                    control={form.control}
                                    name="require_member_registration"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-blue-50/30">
                                            <FormControl>
                                                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="text-blue-700 font-bold">신규고객 자동 회원가입 사용</FormLabel>
                                                <FormDescription>
                                                    처음 방문한 고객의 핸드폰 번호 입력 시, 이름 입력 화면을 띄워 회원으로 자동 등록합니다.
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                {form.watch('require_member_registration') && (
                                    <FormField
                                        control={form.control}
                                        name="registration_message"
                                        render={({ field }) => (
                                            <FormItem className="pl-4">
                                                <FormLabel className="text-xs font-semibold text-blue-600">신규회원 등록 안내 문구</FormLabel>
                                                <FormControl>
                                                    <textarea
                                                        className="flex min-h-[60px] w-full rounded-md border border-blue-100 bg-blue-50/10 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                                                        placeholder="예: 처음 방문하셨네요!\n성함을 입력해 주세요."
                                                        {...field}
                                                        value={field.value || ''}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-[10px]">이름 입력 화면에 표시될 커스텀 메시지입니다. (\n으로 줄바꿈 가능)</FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                )}
                                <FormField
                                    control={form.control}
                                    name="auto_register_member"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0 opacity-60">
                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                            <FormLabel className='font-normal text-xs text-slate-500'>[고급] 이름 입력 없이 번호만으로 자동 등록 (비활성 권장)</FormLabel>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Section 5: Traffic & Features */}
                    <AccordionItem value="feature">
                        <AccordionTrigger>기능 활성화 (트래픽 관리)</AccordionTrigger>
                        <AccordionContent className="p-2">
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="enable_waiting_board"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                            <FormControl>
                                                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>대기현황판 사용</FormLabel>
                                                <FormDescription>실시간 대기 현황판 기능을 활성화합니다.</FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="enable_reception_desk"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                            <FormControl>
                                                <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>대기접수 데스크 사용</FormLabel>
                                                <FormDescription>키오스크/태블릿 접수 기능을 활성화합니다.</FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="max_dashboard_connections"
                                    render={({ field }) => (
                                        <FormItem className="rounded-md border p-4 shadow-sm bg-orange-50/20">
                                            <div className="flex flex-row items-center justify-between gap-4">
                                                <div className="space-y-1">
                                                    <FormLabel className="text-orange-700 font-bold">동시 대시보드 접속 허용 대수</FormLabel>
                                                    <FormDescription className="text-xs">
                                                        한 매장에서 동시에 관리자 화면을 열 수 있는 최대 기기 수입니다.
                                                        (권장: 2대)
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <div className="w-24">
                                                        <Input type="number" {...field} className="text-right font-bold" />
                                                    </div>
                                                </FormControl>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dashboard_connection_policy"
                                    render={({ field }) => (
                                        <FormItem className="rounded-md border p-4 shadow-sm bg-orange-50/10">
                                            <div className="flex flex-col gap-2">
                                                <FormLabel className="text-orange-900 font-semibold">접속 초과 시 처리 방법</FormLabel>
                                                <FormDescription className="text-xs mb-2">
                                                    허용된 대수를 초과하여 새로운 기기가 접속할 때의 처리 방식을 선택합니다.
                                                </FormDescription>
                                                <Select onValueChange={field.onChange} value={field.value || 'eject_old'}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-white">
                                                            <SelectValue placeholder="처리 방법 선택" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="eject_old">기존 기기 접속 끊기 (가장 오래된 기기 종료)</SelectItem>
                                                        <SelectItem value="block_new">신규 접속 차단 (먼저 접속한 기기 우선)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <Button type="submit" size="lg" className="w-full">설정 저장</Button>
            </form>
        </Form>
    );
}
