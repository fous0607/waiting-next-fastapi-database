'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import api from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [rememberId, setRememberId] = useState(false);
    const [rememberPassword, setRememberPassword] = useState(false);

    // Load saved credentials on mount
    useEffect(() => {
        const savedUsername = localStorage.getItem('saved_username');
        const savedPassword = localStorage.getItem('saved_password');

        if (savedUsername) {
            setFormData(prev => ({ ...prev, username: savedUsername }));
            setRememberId(true);
        }

        if (savedPassword) {
            setFormData(prev => ({ ...prev, password: savedPassword }));
            setRememberPassword(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Backend expects form-data for OAuth2
            const params = new URLSearchParams();
            params.append('username', formData.username);
            params.append('password', formData.password);

            const response = await api.post('/auth/login', params, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            console.log('[LOGIN] Full response:', response.data);
            const { access_token, store, role } = response.data;
            console.log('[LOGIN] Extracted values:', { access_token: access_token ? 'EXISTS' : 'MISSING', role, store });

            if (!access_token) {
                throw new Error('No access token received from server');
            }

            localStorage.setItem('access_token', access_token);
            localStorage.setItem('user_role', role);
            console.log('[LOGIN] Saved to localStorage:', {
                access_token: localStorage.getItem('access_token') ? 'SAVED' : 'FAILED',
                user_role: localStorage.getItem('user_role')
            });

            // Save store information for store-level users and dedicated terminals
            if (store && (role === 'store_admin' || role === 'store_manager' || role === 'store_reception' || role === 'store_board')) {
                localStorage.setItem('selected_store_id', store.id.toString());
                localStorage.setItem('selected_store_name', store.name);
                localStorage.setItem('selected_store_code', store.code);
            }

            // Persistence logic
            if (rememberId) {
                localStorage.setItem('saved_username', formData.username);
            } else {
                localStorage.removeItem('saved_username');
            }

            if (rememberPassword) {
                localStorage.setItem('saved_password', formData.password);
            } else {
                localStorage.removeItem('saved_password');
            }

            // Set cookie for middleware access
            document.cookie = `access_token=${access_token}; path=/; max-age=86400; SameSite=Lax`;
            toast.success('로그인 성공');

            // Redirect based on role
            if (role === 'system_admin') {
                window.location.href = '/superadmin';
            } else if (role === 'franchise_admin' || role === 'franchise_manager') {
                window.location.href = '/admin';
            } else if (role === 'store_reception') {
                window.location.href = '/reception';
            } else if (role === 'store_board') {
                window.location.href = '/board';
            } else {
                // Store admins/managers go directly to home (Dashboard)
                router.push('/');
            }
        } catch (error: any) {
            console.error(error);
            toast.error('로그인 실패: 아이디 또는 비밀번호를 확인하세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>로그인</CardTitle>
                    <CardDescription>관리자 계정으로 로그인하세요.</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="username">아이디</Label>
                                <Input
                                    id="username"
                                    placeholder="아이디를 입력하세요"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="password">비밀번호</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex items-center space-x-4 pt-2 border-t mt-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="rememberId"
                                        checked={rememberId}
                                        onChange={(e) => setRememberId(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="rememberId" className="text-sm font-normal cursor-pointer">아이디 저장</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="rememberPassword"
                                        checked={rememberPassword}
                                        onChange={(e) => setRememberPassword(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="rememberPassword" className="text-sm font-normal cursor-pointer">비밀번호 저장</Label>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between mt-6">
                        <Button variant="outline" type="button" onClick={() => router.push('/')}>취소</Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? '로그인 중...' : '로그인'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
