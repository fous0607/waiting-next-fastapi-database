
"use client";

import { useEffect, useState } from 'react';
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

// Comprehensive Schema matching Backend StoreSettings
const settingsSchema = z.object({
    store_name: z.string().min(1, '매장명을 입력해주세요.'),
    theme: z.enum(['zinc', 'blue', 'green', 'orange']).optional(),

    // Display Config
    display_classes_count: z.coerce.number().min(1),
    rows_per_class: z.coerce.number().min(1),
    list_direction: z.enum(['vertical', 'horizontal']).default('vertical'),

    // Business Logic
    business_day_start: z.coerce.number().min(0).max(23).default(5),
    daily_opening_rule: z.enum(['strict', 'flexible']).default('strict'),
    auto_closing: z.boolean().default(true),
    closing_action: z.enum(['reset', 'attended']).default('reset'),

    // Limits & Rules
    use_max_waiting_limit: z.boolean().default(true),
    max_waiting_limit: z.coerce.number().min(0).default(50),
    block_last_class_registration: z.boolean().default(false),
    auto_register_member: z.boolean().default(false),
    require_member_registration: z.boolean().default(false),

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

    // Modal & Audio
    waiting_modal_timeout: z.coerce.number().min(1).default(5),
    show_member_name_in_waiting_modal: z.boolean().default(true),
    show_new_member_text_in_waiting_modal: z.boolean().default(true),
    enable_waiting_voice_alert: z.boolean().default(false),
    waiting_voice_message: z.string().optional().nullable(),

    // Traffic
    enable_waiting_board: z.boolean().default(true),
    enable_reception_desk: z.boolean().default(true),

    admin_password: z.string().optional(), // For verification if needed, usually just loaded
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function GeneralSettings() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<SettingsFormValues>({
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        resolver: zodResolver(settingsSchema) as any,
        defaultValues: {
            store_name: '',
            theme: 'zinc',
            display_classes_count: 3,
            rows_per_class: 1,
            list_direction: 'vertical',
            business_day_start: 5,
            daily_opening_rule: 'strict',
            auto_closing: true,
            closing_action: 'reset',
            use_max_waiting_limit: true,
            max_waiting_limit: 50,
            block_last_class_registration: false,
            auto_register_member: false,
            require_member_registration: false,
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
            waiting_modal_timeout: 5,
            show_member_name_in_waiting_modal: true,
            show_new_member_text_in_waiting_modal: true,
            enable_waiting_voice_alert: false,
            enable_waiting_board: true,
            enable_reception_desk: true,
        },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/store/');
                // Map backend response to form values
                // Ensure null values are replaced with defaults for required numeric fields
                form.reset({
                    ...data,
                    display_classes_count: data.display_classes_count || 3,
                    rows_per_class: data.rows_per_class || 1,
                    waiting_board_page_size: data.waiting_board_page_size || 12,
                    waiting_board_rotation_interval: data.waiting_board_rotation_interval || 5,
                    business_day_start: data.business_day_start ?? 5,
                    waiting_manager_max_width: data.waiting_manager_max_width || null,
                    manager_button_size: data.manager_button_size || 'medium',
                    waiting_list_box_size: data.waiting_list_box_size || 'medium',

                    // Prevent uncontrolled to controlled warnings for all checkboxes
                    auto_register_member: data.auto_register_member ?? false,
                    require_member_registration: data.require_member_registration ?? false,
                    show_member_name_in_waiting_modal: data.show_member_name_in_waiting_modal ?? true,
                    show_new_member_text_in_waiting_modal: data.show_new_member_text_in_waiting_modal ?? true,
                    enable_waiting_voice_alert: data.enable_waiting_voice_alert ?? false,
                    enable_waiting_board: data.enable_waiting_board ?? true,
                    enable_reception_desk: data.enable_reception_desk ?? true,
                    auto_closing: data.auto_closing ?? true,
                    use_max_waiting_limit: data.use_max_waiting_limit ?? true,
                    block_last_class_registration: data.block_last_class_registration ?? false,
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
        toast.error(`설정 저장 실패: ${errorMessage}`);
    };

    // Verify render and form state
    console.log("GeneralSettings Rendered. Loading:", isLoading);
    console.log("Current Form Errors:", form.formState.errors);
    console.log("Current Form Values:", form.getValues());

    if (isLoading) {
        return <div className="p-8 flex justify-center">로딩 중...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>기본 설정</CardTitle>
                <CardDescription>매장의 모든 시스템 설정을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        onSubmit={(e) => {
                            console.log("Form submit event triggered");
                            form.handleSubmit(onSubmit, onError)(e);
                        }}
                        className="space-y-6"
                    >

                        {/* Section 1: Basic Information */}
                        <div className="space-y-4 border-b pb-4">
                            <h3 className="text-lg font-medium">매장 기본 정보</h3>
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
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Section 4: Modal & Reception */}
                            <AccordionItem value="reception">
                                <AccordionTrigger>대기접수 및 알림 설정</AccordionTrigger>
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
                                                    <FormLabel>음성 안내 메시지 (옵션)</FormLabel>
                                                    <FormControl><Input placeholder="예: {클래스명} 대기 접수 되었습니다." {...field} value={field.value ?? ''} /></FormControl>
                                                </FormItem>
                                            )}
                                        />
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
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <Button type="submit" size="lg" className="w-full">설정 저장</Button>
                    </form>
                </Form>
            </CardContent>
        </Card >
    );
}
