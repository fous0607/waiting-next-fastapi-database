"use client";
import QRCode from 'react-qr-code';

import { useEffect, useState } from 'react';
import { QRPrintModal } from './QRPrintModal';
import { TestPrintButton } from './TestPrintButton';
import { Loader2, Copy, Check, ClipboardList, XCircle, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from 'sonner';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useOperationLabels } from '@/hooks/useOperationLabels';
import { useVoiceAlert } from '@/hooks/useVoiceAlert';
import { LocalSettingsManager, LocalDeviceSettings } from '@/lib/printer/LocalSettingsManager';

// Comprehensive Schema matching Backend StoreSettings
const settingsSchema = z.object({
    store_name: z.string().min(1, '매장명을 입력해주세요.'),
    theme: z.enum(['zinc', 'blue', 'green', 'orange']).optional(),
    operation_type: z.enum(['general', 'dining']).default('general'),

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

    // Business Hours & Break Time
    business_start_time: z.string().default('09:00'),
    business_end_time: z.string().default('22:00'),
    enable_break_time: z.boolean().default(false),
    break_start_time: z.string().default('12:00'),
    break_end_time: z.string().default('13:00'),

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

    // Board Display Customization
    board_display_template: z.string().default("{이름}"),
    enable_privacy_masking: z.boolean().default(false),

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
    enable_waiting_voice_alert: z.boolean().default(true),
    waiting_voice_message: z.string().optional().nullable(),
    waiting_call_voice_message: z.string().optional().nullable(),

    // Voice Selection (Legacy fields were rate, pitch, name - keep them but map UI)
    waiting_voice_name: z.string().optional().nullable(),
    waiting_voice_rate: z.coerce.number().min(0.1).max(2.0).default(1.0),
    waiting_voice_pitch: z.coerce.number().min(0).max(2).default(1.0),
    waiting_call_voice_repeat_count: z.coerce.number().min(1).max(5).default(1),
    enable_duplicate_registration_voice: z.boolean().default(true),
    duplicate_registration_voice_message: z.string().optional().default("이미 대기 중인 번호입니다."),

    // Traffic
    enable_waiting_board: z.boolean().default(true),
    enable_reception_desk: z.boolean().default(true),
    max_dashboard_connections: z.coerce.number().min(1).max(10).default(2),
    dashboard_connection_policy: z.enum(['eject_old', 'block_new']).default('eject_old'),
    calling_status_display_second: z.coerce.number().min(10).default(60),
    enable_calling_voice_alert: z.boolean().default(true),
    enable_manager_calling_voice_alert: z.boolean().default(false),
    manager_calling_voice_message: z.string().optional().default("{순번}번 {회원명}님, 호출되었습니다."),
    enable_manager_entry_voice_alert: z.boolean().default(false),
    manager_entry_voice_message: z.string().optional().default("{순번}번 {회원명}님, 입장해주세요."),

    sequential_closing: z.boolean().default(false),

    admin_password: z.string().optional(), // For verification if needed, usually just loaded
    registration_message: z.string().default("처음 방문하셨네요!\n성함을 입력해 주세요."),
    detail_mode: z.enum(['standard', 'pickup']).default('standard'),

    // Dining Mode Phase 2 & 3
    enable_party_size: z.boolean().default(false),
    enable_menu_ordering: z.boolean().default(false),
    party_size_config: z.string().optional().nullable(),

    // Receipt Printer Settings
    enable_printer: z.boolean().default(false),
    printer_connection_type: z.enum(['lan', 'bluetooth']).default('lan'),
    printer_connection_mode: z.enum(['local_proxy', 'cloud_queue', 'tablet']).default('local_proxy'),
    printer_proxy_ip: z.string().default('localhost'),
    printer_ip_address: z.string().optional().nullable(),
    printer_port: z.coerce.number().default(9100),
    auto_print_registration: z.boolean().default(true),
    printer_qr_size: z.coerce.number().min(1).max(8).default(4),
    enable_printer_qr: z.boolean().default(true),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function GeneralSettings() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    // Removed unused voices state
    // const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [localSettings, setLocalSettings] = useState<LocalDeviceSettings>({ useLocalSettings: false });

    useEffect(() => {
        setLocalSettings(LocalSettingsManager.getSettings());
    }, []);

    const handleLocalSettingChange = (key: keyof LocalDeviceSettings, value: any) => {
        const newSettings = { ...localSettings, [key]: value };
        setLocalSettings(newSettings);
        LocalSettingsManager.saveSettings(newSettings);
    };

    const form = useForm<SettingsFormValues>({
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        resolver: zodResolver(settingsSchema) as any,
        defaultValues: {
            store_name: '',
            theme: 'zinc',
            operation_type: 'general',
            detail_mode: 'standard',
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
            business_start_time: '09:00',
            business_end_time: '22:00',
            enable_break_time: false,
            break_start_time: '12:00',
            break_end_time: '13:00',
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
            enable_calling_voice_alert: false,
            enable_manager_calling_voice_alert: false,
            manager_calling_voice_message: "{순번}번 {회원명}님, 호출되었습니다.",
            enable_manager_entry_voice_alert: false,
            manager_entry_voice_message: "{순번}번 {회원명}님, 입장해주세요.",
            enable_waiting_board: true,
            enable_reception_desk: true,
            max_dashboard_connections: 2,
            dashboard_connection_policy: 'eject_old',
            sequential_closing: false,
            registration_message: "처음 방문하셨네요!\n성함을 입력해 주세요.",
            enable_party_size: false,
            enable_menu_ordering: false,
            party_size_config: JSON.stringify([
                { id: 'total', label: '총 인원', min: 1, max: 20, required: true }
            ]),
            enable_printer: false,
            printer_connection_type: 'lan',
            printer_ip_address: '',
            printer_port: 9100,
            auto_print_registration: true,
            printer_qr_size: 4,
            enable_printer_qr: true,
        },
    });

    const operationType = form.watch('operation_type') as 'general' | 'dining';
    const labels = useOperationLabels(operationType);

    const [storeCode, setStoreCode] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [previewType, setPreviewType] = useState<'waiting' | 'duplicate' | 'calling'>('waiting');

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

    const formValues = form.watch();
    const { voices: koVoices, speak, speakCall, speakRegistration, speakDuplicate } = useVoiceAlert(formValues);

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
                    business_start_time: data.business_start_time ? data.business_start_time.substring(0, 5) : '09:00',
                    business_end_time: data.business_end_time ? data.business_end_time.substring(0, 5) : '22:00',
                    enable_break_time: data.enable_break_time ?? false,
                    break_start_time: data.break_start_time ? data.break_start_time.substring(0, 5) : '12:00',
                    break_end_time: data.break_end_time ? data.break_end_time.substring(0, 5) : '13:00',
                    enable_revisit_badge: data.enable_revisit_badge ?? false,
                    revisit_period_days: data.revisit_period_days ?? 0,
                    revisit_badge_style: data.revisit_badge_style ?? "indigo_solid",
                    show_member_name_in_waiting_modal: data.show_member_name_in_waiting_modal ?? true,
                    show_new_member_text_in_waiting_modal: data.show_new_member_text_in_waiting_modal ?? true,
                    enable_waiting_voice_alert: data.enable_waiting_voice_alert ?? false,
                    enable_calling_voice_alert: data.enable_calling_voice_alert ?? false,
                    enable_manager_calling_voice_alert: data.enable_manager_calling_voice_alert ?? false,
                    manager_calling_voice_message: data.manager_calling_voice_message || "{순번}번 {회원명}님, 호출되었습니다.",
                    enable_manager_entry_voice_alert: data.enable_manager_entry_voice_alert ?? false,
                    manager_entry_voice_message: data.manager_entry_voice_message || "{순번}번 {회원명}님, 입장해주세요.",
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
                    operation_type: data.operation_type || 'general',
                    enable_party_size: data.enable_party_size ?? false,
                    enable_menu_ordering: data.enable_menu_ordering ?? false,
                    registration_message: data.registration_message || "처음 방문하셨네요!\n성함을 입력해 주세요.",
                    detail_mode: data.detail_mode || 'standard',
                    enable_printer: data.enable_printer ?? false,
                    printer_connection_type: data.printer_connection_type || 'lan',
                    printer_connection_mode: data.printer_connection_mode || 'local_proxy',
                    printer_proxy_ip: data.printer_proxy_ip || 'localhost',
                    printer_ip_address: data.printer_ip_address || '',
                    printer_port: data.printer_port || 9100,
                    auto_print_registration: data.auto_print_registration ?? true,
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
        if (previewType === 'waiting') {
            speakRegistration({ class_name: '테스트교시', display_name: '홍길동', class_order: 1 });
        } else if (previewType === 'duplicate') {
            speakDuplicate();
        } else if (previewType === 'calling') {
            speakCall({ class_order: 1, display_name: '홍길동', class_name: '테스트교시' });
        }
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

                    {/* Operation Mode Selection (Phase 1) */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    매장 영업 방식 선택
                                </h4>
                                <p className="text-xs text-slate-500">매장의 성격에 맞는 대기 관리 방식을 선택하세요.</p>
                            </div>
                            <FormField
                                control={form.control}
                                name="operation_type"
                                render={({ field }) => (
                                    <div className="flex items-center bg-white p-1 rounded-lg border shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => field.onChange('general')}
                                            className={cn(
                                                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                                                field.value === 'general'
                                                    ? "bg-primary text-white shadow-sm"
                                                    : "text-slate-500 hover:text-slate-900"
                                            )}
                                        >
                                            일반 (체험/상담)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => field.onChange('dining')}
                                            className={cn(
                                                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                                                field.value === 'dining'
                                                    ? "bg-primary text-white shadow-sm"
                                                    : "text-slate-500 hover:text-slate-900"
                                            )}
                                        >
                                            외식 (식당/카페)
                                        </button>
                                    </div>
                                )}
                            />
                        </div>

                        <div className="bg-white/50 p-3 rounded-lg border border-dashed border-slate-200">
                            {form.watch('operation_type') === 'general' ? (
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    <strong className="text-primary">일반 방식:</strong> 교시(수업) 기반이나 단순 순번 대기에 최적화되어 있습니다.
                                    기존의 대기 접수 기능을 그대로 사용하며, 차후 업종별 특화 기능을 추가할 수 있습니다.
                                </p>
                            ) : (
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    <strong className="text-primary">외식 방식:</strong> 식당이나 카페 등 테이블 회전이 중요한 매장에 최적화됩니다.
                                    차후 <span className="font-bold underline">메뉴 미리 주문, 인원별 좌석 배치, 주방 출력</span> 등의 기능이 활성화될 예정입니다.
                                </p>
                            )}
                        </div>
                    </div>

                    {form.watch('operation_type') === 'dining' && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm space-y-3 mt-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                        세부 운영 방식 (Service Type)
                                    </h4>
                                    <p className="text-xs text-slate-500">매장 운영 형태를 선택해주세요.</p>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="detail_mode"
                                    render={({ field }) => (
                                        <div className="flex items-center bg-white p-1 rounded-lg border shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => field.onChange('standard')}
                                                className={cn(
                                                    "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                                                    field.value === 'standard'
                                                        ? "bg-orange-500 text-white shadow-sm"
                                                        : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                일반 식당 (후불/테이블)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => field.onChange('pickup')}
                                                className={cn(
                                                    "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                                                    field.value === 'pickup'
                                                        ? "bg-orange-500 text-white shadow-sm"
                                                        : "text-slate-500 hover:text-slate-900"
                                                )}
                                            >
                                                카페/픽업 (선불/진동벨)
                                            </button>
                                        </div>
                                    )}
                                />
                            </div>
                            <div className="bg-white/50 p-3 rounded-lg border border-dashed border-slate-200">
                                {form.watch('detail_mode') === 'standard' ? (
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        <strong className="text-orange-600">일반 식당 모드:</strong> 손님이 테이블 입장을 대기하는 방식입니다. 호출 후 '입장' 처리하면 대기가 완료됩니다.
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        <strong className="text-orange-600">카페/픽업 모드:</strong> 손님이 주문 후 음식을 픽업(수령)하기 위해 대기합니다. 호출 메시지가 "음식이 준비되었습니다"로 변경되며, '수령 완료' 버튼이 제공됩니다.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

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
                                                    대기자 카드 우측 상단에 "재N" 배지를 표시합니다.
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
                                                                <div className={cn("px-1.5 py-0.5 text-[10px] whitespace-nowrap", style.class)}>
                                                                    재2
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

                    {/* Section: Registration Input Settings (Moved from Dining) */}
                    <AccordionItem value="registration-input">
                        <AccordionTrigger>접수 입력 데이터 설정 (인원수 외)</AccordionTrigger>
                        <AccordionContent className="space-y-6 p-4">
                            <FormField
                                control={form.control}
                                name="enable_party_size"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base font-bold">인원수 입력 사용</FormLabel>
                                            <FormDescription className="text-xs text-slate-500">
                                                접수 시 상세 인원수를 입력받습니다. (예: 성인, 유아 등 구분 입력)
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

                            {form.watch('enable_party_size') && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold">👥 인원수 카테고리 구성</h4>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-[11px] bg-white"
                                            onClick={() => {
                                                const current = JSON.parse(form.getValues('party_size_config') || '[]');
                                                const newItem = { id: `cat_${Date.now()}`, label: '새 항목', min: 0, max: 20, required: false };
                                                form.setValue('party_size_config', JSON.stringify([...current, newItem]));
                                            }}
                                        >
                                            + 카테고리 추가
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {(() => {
                                            try {
                                                const categories = JSON.parse(form.watch('party_size_config') || '[]');
                                                return categories.map((cat: any, index: number) => (
                                                    <div key={cat.id} className="flex items-end gap-3 p-3 rounded-md bg-white border border-slate-200 shadow-sm relative group">
                                                        <div className="flex-1 space-y-2">
                                                            <Label className="text-[10px] text-slate-500">항목명</Label>
                                                            <Input
                                                                className="h-9 text-sm"
                                                                value={cat.label}
                                                                onChange={(e) => {
                                                                    const newCats = [...categories];
                                                                    newCats[index].label = e.target.value;
                                                                    form.setValue('party_size_config', JSON.stringify(newCats));
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="w-32 space-y-2 text-center">
                                                            <Label className="text-[10px] text-slate-500">유형 (Type)</Label>
                                                            <Select
                                                                value={cat.type === 'opt' || cat.required === false ? 'opt' : 'std'}
                                                                onValueChange={(v) => {
                                                                    const newCats = [...categories];
                                                                    newCats[index].type = v;
                                                                    newCats[index].required = v === 'std';
                                                                    form.setValue('party_size_config', JSON.stringify(newCats));
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-9 text-[11px]"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="std">인원수 포함</SelectItem>
                                                                    <SelectItem value="opt">옵션/비포함</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="w-20 space-y-2">
                                                            <Label className="text-[10px] text-slate-500">최대값</Label>
                                                            <Input
                                                                type="number"
                                                                className="h-9 text-sm text-right"
                                                                value={cat.max}
                                                                onChange={(e) => {
                                                                    const newCats = [...categories];
                                                                    newCats[index].max = parseInt(e.target.value) || 0;
                                                                    form.setValue('party_size_config', JSON.stringify(newCats));
                                                                }}
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-9 px-2 text-rose-500 hover:bg-rose-50"
                                                            onClick={() => {
                                                                const newCats = categories.filter((_: any, i: number) => i !== index);
                                                                form.setValue('party_size_config', JSON.stringify(newCats));
                                                            }}
                                                        >
                                                            삭제
                                                        </Button>
                                                    </div>
                                                ));
                                            } catch (e) {
                                                return <p className="text-xs text-rose-500">설정 데이터 오류</p>;
                                            }
                                        })()}
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                        * 필수 항목은 1명 이상 입력해야 접수가 가능합니다.<br />
                                        * 최대값은 해당 카테고리에서 선택 가능한 최대 인원입니다.
                                    </p>
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>

                    {operationType === 'dining' && (
                        <AccordionItem value="dining-specialized" className="border-orange-100 bg-orange-50/10">
                            <AccordionTrigger className="text-orange-700 font-bold px-2 hover:no-underline">
                                🍳 외식 모드 특화 기능 (Dining Specialized)
                            </AccordionTrigger>
                            <AccordionContent className="space-y-6 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* enable_party_size moved to Registration Input section */}
                                    <FormField
                                        control={form.control}
                                        name="enable_menu_ordering"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-orange-200 p-4 bg-white shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base text-orange-900 font-bold">메뉴 미리 주문 사용</FormLabel>
                                                    <FormDescription className="text-orange-700/70 text-xs">
                                                        접수 시 메뉴를 미리 선택할 수 있게 합니다.
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
                                </div>

                                {/* Party Size Config moved to Registration Input section */}
                            </AccordionContent>
                        </AccordionItem>
                    )}

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
                                                const entryUrl = `${origin}/entry/${storeCode}`;

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
                                                        window.open(`/entry/${storeCode}`, '_blank');
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

                    {/* Section: Receipt Printer Configuration */}
                    <AccordionItem value="printer">
                        <AccordionTrigger>영수증 프린터 설정 (Receipt Printer)</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                            <div className="rounded-lg border bg-slate-50 p-4 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="enable_printer"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base">영수증 프린터 사용</FormLabel>
                                                <FormDescription>
                                                    대기 접수 시 번호표를 출력합니다.
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {form.watch('enable_printer') && (
                                    <div className="space-y-4 pt-2 border-t border-slate-200 animate-in fade-in slide-in-from-top-2">
                                        <FormField
                                            control={form.control}
                                            name="printer_connection_type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>연결 방식</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="연결 방식 선택" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="lan">LAN / Wi-Fi (권장)</SelectItem>
                                                            <SelectItem value="bluetooth">Bluetooth (웹 지원 모델)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="printer_connection_mode"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>연결 모드 (Connection Mode)</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="연결 모드 선택" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="local_proxy">로컬 프록시 (PC 설치)</SelectItem>
                                                            <SelectItem value="cloud_queue">클라우드 큐 (예정)</SelectItem>
                                                            <SelectItem value="tablet">태블릿 (준비 중)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormDescription className="text-xs">
                                                        * 로컬 프록시: PC에서 실행 중인 중계 프로그램을 통해 출력합니다.<br />
                                                        * 클라우드 큐: 서버를 통해 원격으로 출력합니다 (준비 중).
                                                    </FormDescription>
                                                </FormItem>
                                            )}
                                        />

                                        {form.watch('printer_connection_mode') === 'local_proxy' && (
                                            <FormField
                                                control={form.control}
                                                name="printer_proxy_ip"
                                                render={({ field }) => (
                                                    <FormItem className="bg-slate-100 p-3 rounded-md border border-slate-200">
                                                        <FormLabel className="flex items-center gap-2">
                                                            프록시 서버 주소 (PC IP)
                                                            <div className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-bold">필수</div>
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="예: localhost 또는 192.168.0.x" {...field} />
                                                        </FormControl>
                                                        <FormDescription>
                                                            프린터 프록시 프로그램이 실행 중인 PC의 주소입니다.<br />
                                                            태블릿에서 PC로 연결하려면 PC의 IP를 입력하세요 (예: 192.168.0.5).
                                                        </FormDescription>
                                                    </FormItem>
                                                )}
                                            />
                                        )}

                                        {form.watch('printer_connection_type') === 'lan' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3 rounded-md border border-slate-200">
                                                <FormField
                                                    control={form.control}
                                                    name="printer_ip_address"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>프린터 IP 주소</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="예: 192.168.0.200" {...field} value={field.value || ''} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="printer_port"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>포트 번호</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" {...field} />
                                                            </FormControl>
                                                            <FormDescription>기본값: 9100</FormDescription>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}

                                        <FormField
                                            control={form.control}
                                            name="auto_print_registration"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="font-normal text-sm">
                                                        대기 접수 시 자동으로 번호표 출력
                                                    </FormLabel>
                                                </FormItem>
                                            )}
                                        />

                                        {/* QR Code Settings (Moved here) */}
                                        <div className="space-y-4 pt-4 border-t">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="enable_printer_qr"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-base">영수증 QR 코드 사용</FormLabel>
                                                                <FormDescription>
                                                                    영수증에 현재 대기 상황 확인용 QR 코드를 인쇄합니다.
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

                                                {form.watch('enable_printer_qr') && (
                                                    <div className="space-y-2">
                                                        <Label>영수증 QR 코드 크기 (1: 작음 ~ 8: 큼)</Label>
                                                        <div className="flex items-center space-x-4 h-full pt-2">
                                                            <FormField
                                                                control={form.control}
                                                                name="printer_qr_size"
                                                                render={({ field }) => (
                                                                    <>
                                                                        <input
                                                                            type="range"
                                                                            min="1"
                                                                            max="8"
                                                                            step="1"
                                                                            value={field.value || 4}
                                                                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                                                                            className="w-[60%] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
                                                                        />
                                                                        <span className="w-12 text-center font-medium border rounded p-1">
                                                                            {field.value || 4}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-6 border-t border-slate-200">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                                        <span className="text-purple-600">★</span> 기기별 프린터/프록시 설정
                                                    </h4>
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        이 태블릿(브라우저)에서 사용할 독립적인 설정을 등록하고 선택하세요.<br />
                                                        주방용, 카운터용 등 여러 설정을 미리 등록해두고 간편하게 전환할 수 있습니다.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={localSettings.useLocalSettings}
                                                    onCheckedChange={(val) => handleLocalSettingChange('useLocalSettings', val)}
                                                />
                                            </div>

                                            {localSettings.useLocalSettings && (
                                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">

                                                    {/* Active Settings Display */}
                                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <Check className="w-5 h-5 text-purple-600" />
                                                            <span className="font-bold text-purple-900">현재 적용된 설정</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                                                                <Label className="text-xs font-semibold text-slate-500 block mb-1">로컬 프록시 IP</Label>
                                                                <div className="font-mono text-lg font-bold text-slate-800">
                                                                    {localSettings.proxyIp || <span className="text-gray-300">미설정</span>}
                                                                </div>
                                                            </div>
                                                            <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm">
                                                                <Label className="text-xs font-semibold text-slate-500 block mb-1">목표 프린터 IP</Label>
                                                                <div className="font-mono text-lg font-bold text-slate-800">
                                                                    {localSettings.printerIp || <span className="text-gray-300">미설정</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Profile Registry */}
                                                    <div className="border rounded-xl p-4 bg-slate-50/50">
                                                        <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                                            <ClipboardList className="w-4 h-4" /> 설정 목록 (등록됨)
                                                        </h5>

                                                        <div className="grid gap-3">
                                                            {/* Saved Profiles List */}
                                                            {localSettings.profiles?.map((profile) => (
                                                                <div key={profile.id} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-all">
                                                                    <div className="flex-1">
                                                                        <div className="font-bold text-sm text-slate-800">{profile.name}</div>
                                                                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                                            Proxy: {profile.proxyIp} / Printer: {profile.printerIp}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Button
                                                                            variant={
                                                                                localSettings.proxyIp === profile.proxyIp && localSettings.printerIp === profile.printerIp
                                                                                    ? "default"
                                                                                    : "outline"
                                                                            }
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                handleLocalSettingChange('proxyIp', profile.proxyIp);
                                                                                handleLocalSettingChange('printerIp', profile.printerIp);
                                                                                toast.success(`'${profile.name}' 설정이 적용되었습니다.`);
                                                                            }}
                                                                            className="h-8 text-xs font-bold"
                                                                        >
                                                                            {localSettings.proxyIp === profile.proxyIp && localSettings.printerIp === profile.printerIp
                                                                                ? "적용됨" : "적용하기"
                                                                            }
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                                            onClick={() => {
                                                                                const newProfiles = localSettings.profiles?.filter(p => p.id !== profile.id) || [];
                                                                                handleLocalSettingChange('profiles', newProfiles);
                                                                            }}
                                                                        >
                                                                            <XCircle className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}

                                                            {(!localSettings.profiles || localSettings.profiles.length === 0) && (
                                                                <div className="text-center py-6 text-sm text-slate-400 border-dashed border-2 rounded-lg">
                                                                    등록된 설정이 없습니다. 아래에서 추가해주세요.
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Add New Profile Form */}
                                                        <div className="mt-4 pt-4 border-t">
                                                            <div className="grid gap-3 p-3 bg-white rounded-lg border">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                                    <Input
                                                                        id="new_profile_name"
                                                                        placeholder="예: 주방 프린터, 2층 카운터..."
                                                                        className="h-9 text-sm"
                                                                    />
                                                                    <Input
                                                                        id="new_profile_proxy"
                                                                        placeholder="프록시 IP (예: 192.168.0.x)"
                                                                        className="h-9 text-sm font-mono"
                                                                    />
                                                                    <Input
                                                                        id="new_profile_printer"
                                                                        placeholder="프린터 IP (예: 192.168.0.200)"
                                                                        className="h-9 text-sm font-mono"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="secondary"
                                                                    className="w-full"
                                                                    onClick={() => {
                                                                        const nameEl = document.getElementById('new_profile_name') as HTMLInputElement;
                                                                        const proxyEl = document.getElementById('new_profile_proxy') as HTMLInputElement;
                                                                        const printerEl = document.getElementById('new_profile_printer') as HTMLInputElement;

                                                                        if (!nameEl.value || !proxyEl.value || !printerEl.value) {
                                                                            toast.error("모든 항목을 입력해주세요.");
                                                                            return;
                                                                        }

                                                                        const newProfile = {
                                                                            id: Date.now().toString(),
                                                                            name: nameEl.value,
                                                                            proxyIp: proxyEl.value,
                                                                            printerIp: printerEl.value
                                                                        };

                                                                        const currentProfiles = localSettings.profiles || [];
                                                                        handleLocalSettingChange('profiles', [...currentProfiles, newProfile]);

                                                                        // Clear inputs
                                                                        nameEl.value = '';
                                                                        proxyEl.value = '';
                                                                        printerEl.value = '';

                                                                        toast.success("새로운 설정이 등록되었습니다.");
                                                                    }}
                                                                >
                                                                    <UserPlus className="w-4 h-4 mr-2" /> 새 설정 등록하기
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <TestPrintButton settings={{ ...form.watch(), store_code: storeCode }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </AccordionContent>
                    </AccordionItem>

                    {/* Section 2: Display Configuration */}
                    <AccordionItem value="display">
                        <AccordionTrigger>화면 표시 설정 ({labels.waitingLabel} 현황/사이즈)</AccordionTrigger>
                        <AccordionContent className="space-y-4 p-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="display_classes_count"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>한 화면당 표시할 {labels.classLabel} 개수</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="rows_per_class"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{labels.classLabel}별 표시 줄 수 (Row)</FormLabel>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="list_direction"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{labels.waitingLabel} 리스트 방향</FormLabel>
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
                                            <FormLabel>{labels.waitingLabel}관리자 버튼 크기</FormLabel>
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



                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-6 mb-6">
                                <h4 className="font-bold mb-3 text-sm text-slate-700 flex items-center gap-2">
                                    <span className="text-blue-500">★</span> 대기자 박스 표시 설정 (템플릿)
                                </h4>
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="board_display_template"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>표시 형식 (Template)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="{이름}" className="font-mono bg-white" />
                                                </FormControl>
                                                <FormDescription className="text-xs space-y-1">
                                                    변수를 사용하여 표시 형식을 자유롭게 설정하세요.<br />
                                                    <span className="inline-block bg-slate-200 rounded px-1 text-slate-700 mx-1">{'{순번}'}</span>
                                                    <span className="inline-block bg-slate-200 rounded px-1 text-slate-700 mx-1">{'{대기번호}'}</span>
                                                    <span className="inline-block bg-slate-200 rounded px-1 text-slate-700 mx-1">{'{이름}'}</span>
                                                    <span className="inline-block bg-slate-200 rounded px-1 text-slate-700 mx-1">{'{인원}'}</span>
                                                </FormDescription>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="enable_privacy_masking"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-white">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-sm">개인정보 마스킹 (이름 가리기)</FormLabel>
                                                    <FormDescription className="text-xs">
                                                        이름의 가운데 글자를 '*'로 표시합니다. (예: 홍길동 → 홍*동)
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
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
                            <div className="rounded-lg border bg-slate-50 p-4 space-y-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    {labels.classAction} 및 휴게 시간 설정
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="business_start_time"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>영업 시작 시간</FormLabel>
                                                <FormControl><Input type="time" {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="business_end_time"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>영업 종료 시간</FormLabel>
                                                <FormControl><Input type="time" {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4 pt-2 border-t border-slate-200">
                                    <FormField
                                        control={form.control}
                                        name="enable_break_time"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-sm font-medium">브레이크 타임 사용</FormLabel>
                                                    <FormDescription className="text-xs">
                                                        설정된 시간에는 대기 접수를 자동으로 차단합니다.
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {form.watch('enable_break_time') && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <FormField
                                                control={form.control}
                                                name="break_start_time"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">휴게 시작</FormLabel>
                                                        <FormControl><Input type="time" {...field} /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="break_end_time"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">휴게 종료</FormLabel>
                                                        <FormControl><Input type="time" {...field} /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="enable_waiting_voice_alert"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 h-10">
                                                <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className='font-normal'>접수 완료 음성 안내</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="enable_duplicate_registration_voice"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 h-10">
                                                <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className='font-normal'>중복 접수 시 음성 경고</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="waiting_voice_message"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">접수 완료 안내 메시지</FormLabel>
                                                <FormControl><Input className="h-9 text-xs" placeholder="예: {클래스명}  {회원명}님 대기 접수 되었습니다." {...field} value={field.value ?? ''} /></FormControl>
                                                <FormDescription className="text-[10px]">
                                                    {`{ 클래스명 }, { 회원명 }, { 순번 }, { 대기번호 } 사용 가능`}
                                                </FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="duplicate_registration_voice_message"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">중복 접수 시 경고 메시지</FormLabel>
                                                <FormControl><Input className="h-9 text-xs" placeholder="예: 이미 대기 중인 번호입니다." {...field} value={field.value ?? ''} /></FormControl>
                                                <FormDescription className="text-[10px]">
                                                    이미 접수된 번호 입력 시 들려줄 메시지입니다.
                                                </FormDescription>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4 rounded-lg border p-4 bg-slate-50/50">
                                    <FormField
                                        control={form.control}
                                        name="enable_calling_voice_alert"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                <FormLabel className='font-normal'>호출 시 음성안내</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                    {form.watch('enable_calling_voice_alert') && (
                                        <FormField
                                            control={form.control}
                                            name="waiting_call_voice_message"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">호출 메시지 커스텀</FormLabel>
                                                    <FormControl><Input placeholder="예: {순번}번 {회원명}님, 데스크로 오시기 바랍니다." {...field} value={field.value ?? ''} /></FormControl>
                                                    <FormDescription className="text-[10px]">
                                                        {`{ 회원명 }, { 순번 }, { 클래스명 }, { 대기번호 }을 사용할 수 있습니다. (대기현황판 전용)`}
                                                    </FormDescription>
                                                </FormItem>
                                            )}
                                        />
                                    )}

                                    <div className="pt-2 border-t mt-4">
                                        <FormLabel className="text-sm font-semibold mb-3 block">대기관리자 음성안내</FormLabel>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Manager Calling Alert */}
                                            <div className="space-y-2">
                                                <FormField
                                                    control={form.control}
                                                    name="enable_manager_calling_voice_alert"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                            <FormLabel className='font-normal'>호출 알림 (비상용)</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                                {form.watch('enable_manager_calling_voice_alert') && (
                                                    <FormField
                                                        control={form.control}
                                                        name="manager_calling_voice_message"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="예: {순번}번 {회원명}님, 호출되었습니다."
                                                                        className="h-8 text-xs"
                                                                        {...field}
                                                                        value={field.value ?? ''}
                                                                    />
                                                                </FormControl>
                                                                <FormDescription className="text-[10px]">
                                                                    {`{순번}, {회원명}, {대기번호} 사용 가능`}
                                                                </FormDescription>
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}
                                            </div>

                                            {/* Manager Entry Alert */}
                                            <div className="space-y-2">
                                                <FormField
                                                    control={form.control}
                                                    name="enable_manager_entry_voice_alert"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl><Checkbox checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                                                            <FormLabel className='font-normal'>입장 알림 (비상용)</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                                {form.watch('enable_manager_entry_voice_alert') && (
                                                    <FormField
                                                        control={form.control}
                                                        name="manager_entry_voice_message"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="예: {순번}번 {회원명}님, 입장해주세요."
                                                                        className="h-8 text-xs"
                                                                        {...field}
                                                                        value={field.value ?? ''}
                                                                    />
                                                                </FormControl>
                                                                <FormDescription className="text-[10px]">
                                                                    {`{순번}, {회원명}, {대기번호} 사용 가능`}
                                                                </FormDescription>
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {(form.watch('enable_waiting_voice_alert') || form.watch('enable_calling_voice_alert')) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <FormField
                                        control={form.control}
                                        name="waiting_voice_name"
                                        render={({ field }) => {
                                            console.log('Rendering Voice Select. current value:', field.value);
                                            console.log('Available Voices (koVoices):', koVoices);

                                            return (
                                                <FormItem>
                                                    <FormLabel className="text-xs">목소리 선택 (성별/유형)</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-9 text-xs">
                                                                <SelectValue placeholder="목소리를 선택하세요" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {(!koVoices || koVoices.length === 0) && <SelectItem value="default">시스템 기본값 (목록 없음)</SelectItem>}
                                                            {koVoices && koVoices.map((voice: any) => (
                                                                <SelectItem key={voice.name} value={voice.name} className="text-xs">
                                                                    {voice.displayName}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )
                                        }}
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
                                                        <SelectItem value="1">보통 (1.0x)</SelectItem>
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
                                    <div className="md:col-span-2 flex flex-col md:flex-row justify-end items-end gap-3 pt-2">
                                        <div className="w-full md:w-48">
                                            <FormLabel className="text-xs mb-1.5 block">미리듣기 항목 선택</FormLabel>
                                            <Select
                                                value={previewType}
                                                onValueChange={(val: 'waiting' | 'duplicate' | 'calling') => setPreviewType(val)}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="waiting" className="text-xs">접수 완료 안내</SelectItem>
                                                    <SelectItem value="duplicate" className="text-xs">중복 접수 경고</SelectItem>
                                                    <SelectItem value="calling" className="text-xs">호출 안내 (호출 시)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-8 w-full md:w-auto"
                                            onClick={handlePreviewVoice}
                                        >
                                            미리듣기 (Preview)
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <FormField
                                control={form.control}
                                name="enable_waiting_board"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">대기현황판 사용</FormLabel>
                                            <FormDescription>
                                                대기현황판 화면(TV/모니터)을 사용합니다.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="calling_status_display_second"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col gap-2 rounded-lg border p-4 shadow-sm bg-slate-50/50">
                                        <div className="flex justify-between items-center">
                                            <div className="space-y-0.5">
                                                <FormLabel className="text-base flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                    '호출중' 배지 표시 시간
                                                </FormLabel>
                                                <FormDescription>
                                                    고객 호출 시 현황판에 배지가 표시되는 시간을 설정합니다.
                                                </FormDescription>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-primary">{field.value}초</span>
                                            </div>
                                        </div>
                                        <FormControl>
                                            <div className="flex gap-2 mt-2">
                                                {[10, 30, 60, 180].map((sec) => (
                                                    <div
                                                        key={sec}
                                                        onClick={() => field.onChange(sec)}
                                                        className={cn(
                                                            "flex-1 py-2 text-center rounded-md cursor-pointer text-sm transition-all border",
                                                            field.value === sec
                                                                ? "bg-primary text-white border-primary font-bold shadow-sm"
                                                                : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"
                                                        )}
                                                    >
                                                        {sec < 60 ? `${sec}초` : `${sec / 60}분`}
                                                    </div>
                                                ))}
                                            </div>
                                        </FormControl>
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
            </form >
        </Form >
    );
}
