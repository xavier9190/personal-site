import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

export const metadata: Metadata = {
  title: 'PERSONAL SITE — HUB PESSOAL',
  description:
    'HUB PESSOAL SINGLE-USER INTEGRADO (CHAT IA, CALENDÁRIO, FINANÇAS, ACADÊMICO, COMPRAS)',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-[#121212] text-[#f1f3f5] uppercase antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <AppSidebar />
          <main className="flex-1 overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </body>
    </html>
  );
}
