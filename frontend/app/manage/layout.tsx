
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "대기자 관리 | WaitingPos",
    description: "매장 대기 현황 관리 및 호출 시스템",
};

export default function ManageLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <section className="min-h-screen bg-background font-sans antialiased">
            {children}
        </section>
    );
}
