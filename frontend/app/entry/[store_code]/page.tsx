'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

const formSchema = z.object({
    phone: z.string().min(8, '휴대폰 번호를 입력해주세요 (예: 01012345678 또는 12345678)'),
    name: z.string().optional(),
});

export default function EntryPage({ params }: { params: Promise<{ store_code: string }> }) {
    const { store_code } = use(params);
    const router = useRouter();
    const [store, setStore] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            phone: '010',
            name: '',
        },
    });

    useEffect(() => {
        const fetchStore = async () => {
            if (!store_code) return;
            try {
                const { data } = await api.get(`/public/store/${store_code}`);
                setStore(data);
            } catch (error) {
                toast.error('매장 정보를 불러올 수 없습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchStore();
    }, [store_code]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setRegistering(true);
        try {
            // Process phone number: ensure it starts with 010
            let processedPhone = values.phone.replace(/[^0-9]/g, '');
            if (processedPhone.length === 8) {
                processedPhone = '010' + processedPhone;
            }

            // Process name: if empty, use last 4 digits of phone
            const processedName = values.name && values.name.trim() !== ''
                ? values.name
                : processedPhone.slice(-4);

            await api.post(`/public/waiting/${store_code}/register`, {
                phone: processedPhone,
                name: processedName
            });

            toast.success('대기가 접수되었습니다.');
            router.push(`/entry/${store_code}/status?phone=${processedPhone}`);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || '대기 접수에 실패했습니다.');
        } finally {
            setRegistering(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    if (!store) {
        return <div className="flex justify-center items-center h-screen text-lg font-semibold">매장을 찾을 수 없습니다.</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <span className="text-xl font-bold text-primary">WAIT</span>
                    </div>
                    <CardTitle className="text-2xl mb-1">{store.name}</CardTitle>
                    <div className="flex flex-col items-center gap-3 mb-4">
                        <div className="bg-slate-100 px-4 py-2 rounded-lg flex items-center gap-2">
                            <span className="text-slate-600 font-medium">현재 총 대기</span>
                            <span className="text-xl font-bold text-primary">{store.current_waiting_count || 0}팀</span>
                        </div>

                        {(store.is_business_hours === false || store.is_break_time === true) && (
                            <div className="w-full bg-red-50 border border-red-100 p-3 rounded-xl flex flex-col items-center gap-1 animate-in zoom-in duration-300">
                                <span className="text-red-600 font-bold flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    {store.is_break_time ? "휴게 시간 (Break Time)" : "영업 시간 종료"}
                                </span>
                                <span className="text-xs text-red-500 font-medium">
                                    {store.is_break_time
                                        ? `${store.break_time?.start} ~ ${store.break_time?.end} 동안 접수가 제한됩니다.`
                                        : `영업시간: ${store.business_hours?.start} ~ ${store.business_hours?.end}`
                                    }
                                </span>
                            </div>
                        )}
                    </div>

                    <CardDescription>
                        휴대폰 번호를 입력하여 대기를 등록해주세요.<br />
                        <span className="text-xs text-muted-foreground">(성함을 입력하지 않으면 휴대폰 번호 뒷자리로 등록됩니다)</span>
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-lg font-bold">휴대폰 번호</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center justify-center border-2 rounded-2xl overflow-hidden h-20 sm:h-24 bg-white shadow-sm ring-offset-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                                                <div className="bg-slate-50 h-full flex items-center justify-center px-3 sm:px-4 border-r-2 border-slate-100">
                                                    <span className="text-xl sm:text-2xl font-black text-slate-500 tracking-wider">010-</span>
                                                </div>
                                                <Input
                                                    placeholder="0000-0000"
                                                    {...field}
                                                    type="tel"
                                                    inputMode="decimal"
                                                    autoFocus
                                                    className="border-none shadow-none h-full text-3xl sm:text-4xl font-black tracking-[0.1em] sm:tracking-[0.2em] text-center bg-white focus-visible:ring-0 px-2 sm:px-4 placeholder:text-slate-200 placeholder:tracking-normal placeholder:font-bold w-full"
                                                    onChange={(e) => {
                                                        // Get only digits from the input value
                                                        let val = e.target.value.replace(/[^0-9]/g, '');
                                                        // Limit to 8 digits for the suffix
                                                        if (val.length > 8) val = val.slice(0, 8);

                                                        // Construct the full 11-digit phone number for the form field
                                                        const fullPhoneNumber = '010' + val;
                                                        field.onChange(fullPhoneNumber);
                                                    }}
                                                    // Override value prop for display formatting
                                                    value={(() => {
                                                        // Extract the 8-digit suffix from the full 11-digit field.value
                                                        const rawFullNumber = (field.value || '').replace(/[^0-9]/g, '');
                                                        const suffix = rawFullNumber.startsWith('010') ? rawFullNumber.slice(3) : '';

                                                        // Format the suffix with a dash
                                                        if (suffix.length > 4) {
                                                            return `${suffix.slice(0, 4)}-${suffix.slice(4)}`;
                                                        }
                                                        return suffix;
                                                    })()}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>성함 (선택)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="미입력 시 휴대폰 뒷자리" {...field} className="text-lg h-12" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="submit"
                                className="w-full h-12 text-lg font-bold"
                                disabled={registering || (store.is_business_hours === false) || (store.is_break_time === true)}
                            >
                                {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '대기 등록하기'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
