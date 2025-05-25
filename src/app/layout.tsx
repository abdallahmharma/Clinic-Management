import type { Metadata } from 'next';
import { Tajawal } from 'next/font/google'; // Using Tajawal for better Arabic support
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const tajawal = Tajawal({
  weight: ['400', '500', '700'],
  subsets: ['arabic', 'latin'],
  variable: '--font-tajawal',
});

export const metadata: Metadata = {
  title: 'Clinic Management - إدارة العيادات',
  description: 'نظام إدارة المرضى والمواعيد للعيادات الطبية - Clinic Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cn(tajawal.variable, 'font-sans antialiased min-h-screen flex flex-col')}>
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
        <Toaster />
        <footer className="py-6 text-center text-sm text-muted-foreground border-t">
          © {new Date().getFullYear()} ABOD OMAR
        </footer>
      </body>
    </html>
  );
}
