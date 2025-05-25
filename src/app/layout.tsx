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
  title: 'شفاء Clinic - إدارة العيادات',
  description: 'نظام إدارة المرضى والمواعيد للعيادات الطبية',
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
          © {new Date().getFullYear()} شفاء Clinic. جميع الحقوق محفوظة.
        </footer>
      </body>
    </html>
  );
}
