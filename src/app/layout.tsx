import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { PwaRegistrar } from '@/components/layout/PwaRegistrar';

const excalifont = localFont({
  src: '../../public/fonts/Excalifont-Regular.woff2',
  variable: '--font-excalifont',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PERSONAL SITE — HUB PESSOAL',
  description:
    'HUB PESSOAL SINGLE-USER INTEGRADO (CHAT IA, CALENDÁRIO, FINANÇAS, ACADÊMICO, COMPRAS)',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HUB PESSOAL',
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
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
    <html lang="pt-BR" className={`dark ${excalifont.variable}`}>
      <body className="min-h-screen bg-[#121212] text-[#f1f3f5] uppercase antialiased">
        <PwaRegistrar />
        <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
          <AppSidebar />
          <main className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto pb-16 md:h-full md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </body>
    </html>
  );
}
