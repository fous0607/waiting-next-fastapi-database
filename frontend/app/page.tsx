'use client';

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Settings, Users, Monitor, Tablet, LogOut, Play, StopCircle, Loader2, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWaitingStore } from "@/lib/store/useWaitingStore";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import { toast } from "sonner";
import NoticeWidget from "@/components/notice/NoticeWidget";
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';


export default function DashboardPage() {
  const { reset } = useWaitingStore();
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState(''); // Store code state
  const [storeId, setStoreId] = useState(''); // Store ID state for links

  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // State for initial data loading
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // State for store selection
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [availableStores, setAvailableStores] = useState<any[]>([]);

  // State for business date
  const [businessDate, setBusinessDate] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const { data } = await api.get('/daily/check-status');
      setIsOpen(data.is_open);
      if (data.is_open && data.business_date) {
        setBusinessDate(data.business_date);
      } else {
        setBusinessDate(null);
      }
    } catch (error) {
      console.error("Failed to check status", error);
    }
  };

  const loadAvailableStores = async () => {
    try {
      const { data } = await api.get('/store/all');
      setAvailableStores(data);
      return data;
    } catch (error) {
      console.error('Failed to load stores:', error);
      return [];
    }
  };

  const selectStore = (store: any) => {
    localStorage.setItem('selected_store_id', store.id.toString());
    localStorage.setItem('selected_store_name', store.name);
    localStorage.setItem('selected_store_code', store.code);
    setStoreName(store.name);
    setStoreCode(store.code);
    setStoreId(store.id.toString());
    setShowStoreSelector(false);
    // Reload page to fetch store-specific data
    window.location.reload();
  };

  useEffect(() => {
    const initializeStore = async () => {
      // 0. Check role and redirect if superadmin
      const userRole = localStorage.getItem('user_role');
      if (userRole === 'system_admin') {
        router.replace('/superadmin');
        return;
      }

      // 1. Try to load from localStorage first for immediate display
      const storedName = localStorage.getItem('selected_store_name');
      const storedCode = localStorage.getItem('selected_store_code'); // Load code
      const storedId = localStorage.getItem('selected_store_id');

      if (storedName) {
        setStoreName(storedName);
      }
      if (storedCode) setStoreCode(storedCode);
      if (storedId) setStoreId(storedId);

      // 2. For franchise admins/managers, check if store is selected
      if (userRole === 'franchise_admin' || userRole === 'franchise_manager') {
        if (!storedId) {
          // No store selected, show selector
          const stores = await loadAvailableStores();
          if (stores.length > 0) {
            setShowStoreSelector(true);
          }
          setIsInitialLoading(false);
          return;
        }
      }

      // 3. Always fetch fresh data from API to ensure correctness (Network First for validity)
      try {
        // Use the same endpoint as Manage page: /store (which maps to store_settings)
        // or /stores/current if available. Let's use /store since Manage uses it.
        // Wait, Manage uses /store? Let's verify route.
        // store_settings router is at /api/store. So api.get('/store') is correct.

        const { data } = await api.get('/store');

        // Handle potential array response (some endpoints return list)
        // or object response. StoreSettings returns object.
        const storeData = Array.isArray(data) ? data[0] : data;

        if (storeData) {
          const name = storeData.store_name || storeData.name;
          const code = storeData.store_code || storeData.code; // Get code
          // CRITICAL FIX: The endpoint returns StoreSettings, where .id is the SETTINGS ID (e.g. 7).
          // We must ONLY use .store_id (e.g. 12). DO NOT fallback to .id.
          // If store_id is missing (old backend), it's better to keep existing localStorage value than to overwrite with wrong ID.
          const realStoreId = storeData.store_id;

          if (name) {
            setStoreName(name);
            localStorage.setItem('selected_store_name', name);
          }
          if (code) {
            setStoreCode(code);
            localStorage.setItem('selected_store_code', code);
          }
          if (realStoreId) {
            const idStr = realStoreId.toString();
            setStoreId(idStr);
            localStorage.setItem('selected_store_id', idStr);
          }
        }
      } catch (error) {
        console.error('Failed to fetch store info:', error);
        // If API fails and user is franchise admin, show store selector
        if (userRole === 'franchise_admin' || userRole === 'franchise_manager') {
          const stores = await loadAvailableStores();
          if (stores.length > 0) {
            setShowStoreSelector(true);
          }
        }
      } finally {
        setIsInitialLoading(false);
      }
    };

    initializeStore();

    // Only check status for non-system admins
    const userRole = localStorage.getItem('user_role');
    if (userRole !== 'system_admin') {
      checkStatus();
    }
  }, []);

  if (isInitialLoading && !storeName) {
    return <GlobalLoader message="매장 정보를 불러오는 중입니다..." />;
  }

  // Show store selector for franchise admins
  if (showStoreSelector) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="w-[500px]">
          <CardHeader>
            <CardTitle>매장 선택</CardTitle>
            <CardDescription>관리할 매장을 선택해주세요.</CardDescription>
          </CardHeader>
          <div className="p-6 space-y-2">
            {availableStores.map((store) => (
              <Button
                key={store.id}
                variant="outline"
                className="w-full justify-start text-left h-auto py-4"
                onClick={() => selectStore(store)}
              >
                <div>
                  <div className="font-semibold">{store.name}</div>
                  <div className="text-sm text-muted-foreground">{store.code}</div>
                </div>
              </Button>
            ))}
          </div>
        </Card>
      </div>
    );
  }


  const handleOpenClick = () => {
    setIsOpenModalOpen(true);
  };

  const handleOpenConfirm = async () => {
    setIsProcessing(true);
    try {
      await api.post('/daily/open');
      toast.success("영업이 시작되었습니다.");
      setIsOpen(true);
      // Set to today temporarily until refined by checkStatus or reload
      setBusinessDate(format(new Date(), 'yyyy-MM-dd'));
      setIsOpenModalOpen(false);
    } catch (error) {
      const err = error as any;
      toast.error(err.response?.data?.detail || "개점 실패");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseClick = () => {
    setIsCloseModalOpen(true);
  };

  const handleCloseConfirm = async () => {
    setIsProcessing(true);
    try {
      await api.post('/daily/close');
      toast.success("영업이 마감되었습니다.");
      setIsOpen(false);
      setIsCloseModalOpen(false);
    } catch (error) {
      const err = error as any;
      toast.error(err.response?.data?.detail || "마감 실패");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // 1. 서버에 로그아웃 알림 (여기서 서버가 SSE 연결을 강제 종료함)
      await api.post('/auth/logout');
    } catch (error) {
      console.error("Logout failed on server", error);
    } finally {
      // 2. 서버 응답 여부와 관계없이 로컬 상태 확실히 정리
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('selected_store_id');
      localStorage.removeItem('selected_store_name');
      localStorage.removeItem('selected_store_code');

      // Zustand 상태 초기화
      reset();

      // 세션 쿠키 수동 삭제 (백업용)
      document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

      // 로그인 페이지로 이동 (전체 페이지 리로드)
      window.location.href = '/login';
    }
  };

  const menuItems = [
    {
      title: "대기자 관리",
      description: "대기 현황 확인 및 호출 관리",
      icon: Users,
      href: storeId ? `/manage?store=${storeId}` : "/manage",
      color: "bg-purple-100 text-purple-600"
    },
    {
      title: "대기현황판",
      description: "고객용 대기 현황 모니터",
      icon: Monitor,
      href: storeCode ? `/board?store=${storeCode}` : "/board",
      color: "bg-blue-100 text-blue-600"
    },
    {
      title: "대기접수 (데스크)",
      description: "매장용 접수 화면",
      icon: Tablet, // Corrected icon name
      href: storeCode ? `/reception?store=${storeCode}` : "/reception",
      color: "bg-green-100 text-green-600"
    },
    {
      title: "매장 설정",
      description: "매장 정보 및 시스템 설정",
      icon: Settings,
      href: "/settings",
      color: "bg-slate-100 text-slate-600"
    },
    {
      title: "데이터 분석",
      description: "매장 대기 및 출석 통계 분석",
      icon: BarChart3,
      href: "/admin/stats",
      color: "bg-orange-100 text-orange-600"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center h-10">
              {storeName ? `${storeName} 대시보드` : '매장 대시보드'}
            </h1>
            {isOpen && businessDate ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg border border-green-100">
                  {format(new Date(businessDate), 'yyyy년 MM월 dd일 EEEE', { locale: ko })}
                </span>
                <span className="text-sm text-slate-400 font-medium self-end mb-1">영업 중</span>
              </div>
            ) : (
              <p className="text-slate-500">환영합니다! 원하시는 메뉴를 선택해주세요.</p>
            )}
          </div>
          <div className="flex gap-2">
            {isOpen !== null && (
              isOpen ? (
                <Button
                  variant="destructive"
                  onClick={handleCloseClick}
                  disabled={isProcessing}
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  영업 마감
                </Button>
              ) : (
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleOpenClick}
                  disabled={isProcessing}
                >
                  <Play className="mr-2 h-4 w-4" />
                  영업 개점
                </Button>
              )
            )}
            <Button
              variant="outline"
              onClick={() => {
                setIsLogoutModalOpen(true);
              }}
              disabled={isLoggingOut}
              className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              {isLoggingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              {isLoggingOut ? "로그아웃 중..." : "로그아웃 (TEST)"}
            </Button>
          </div>
        </header>

        <div className="mb-6">
          <NoticeWidget />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => (
            <Link href={item.href} key={item.href}>
              <Card className="h-full hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer border-l-4 border-l-transparent hover:border-l-primary">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className={`p-4 rounded-xl ${item.color}`}>
                    <item.icon className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-1">{item.title}</CardTitle>
                    <CardDescription className="text-base">{item.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <Dialog open={isCloseModalOpen} onOpenChange={setIsCloseModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>영업 마감</DialogTitle>
              <DialogDescription>
                정말 금일 영업을 마감하시겠습니까?<br />
                마감 시 대기 통계가 저장되며, 대기 중인 고객은 자동으로 취소 또는 출석 처리됩니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCloseModalOpen(false)}>취소</Button>
              <Button variant="destructive" onClick={handleCloseConfirm} disabled={isProcessing}>
                {isProcessing ? "처리 중..." : "마감하기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isOpenModalOpen} onOpenChange={setIsOpenModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>영업 개점</DialogTitle>
              <DialogDescription className="pt-4">
                <div className="text-center space-y-4">
                  <div className="py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-2xl font-bold text-green-600">
                      {format(new Date(), 'yyyy년 MM월 dd일 EEEE', { locale: ko })}
                    </p>
                  </div>
                  <p className="leading-relaxed">
                    위 날짜로 새로운 영업을 시작하시겠습니까?<br />
                    <span className="text-xs text-slate-400">대기 번호가 1번부터 초기화됩니다.</span>
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpenModalOpen(false)}>취소</Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleOpenConfirm} disabled={isProcessing}>
                {isProcessing ? "처리 중..." : "개점하기"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isLogoutModalOpen} onOpenChange={setIsLogoutModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>로그아웃</DialogTitle>
              <DialogDescription>
                정말 로그아웃 하시겠습니까?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLogoutModalOpen(false)}>취소</Button>
              <Button variant="destructive" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
