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
    phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력해주세요 (예: 01012345678)'),
    name: z.string().min(1, '이름을 입력해주세요'),
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
            phone: '',
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
            await api.post(`/public/waiting/${store_code}/register`, values);
            toast.success('대기가 접수되었습니다.');
            router.push(`/entry/${store_code}/status?phone=${values.phone}`);
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
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <span className="text-xl font-bold text-primary">WAIT</span>
                    </div>
                    <CardTitle className="text-2xl">{store.name}</CardTitle>
                    <CardDescription>
                        휴대폰 번호와 성함을 입력하여 대기를 등록해주세요.
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
                                        <FormLabel>휴대폰 번호</FormLabel>
                                        <FormControl>
                                            <Input placeholder="01012345678" {...field} type="tel" className="text-lg h-12" />
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
                                        <FormLabel>성함</FormLabel>
                                        <FormControl>
                                            <Input placeholder="홍길동" {...field} className="text-lg h-12" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={registering}>
                                {registering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '대기 등록하기'}
                            </Button>
                        </form>
                    </Form>

                    <div className="mt-6 text-center">
                        <Button variant="link" size="sm" onClick={() => router.push(`/entry/${store_code}/status`)}>
                            내 대기 순서 확인하기
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
