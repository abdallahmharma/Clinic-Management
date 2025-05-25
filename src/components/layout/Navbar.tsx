
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, CalendarDays, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'لوحة التحكم', icon: Home },
  { href: '/patients', label: 'المرضى', icon: Users },
  { href: '/appointments', label: 'المواعيد', icon: CalendarDays },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
          <Stethoscope className="h-7 w-7" />
          <h1 className="text-xl font-bold">شفاء Clinic</h1>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              asChild
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === item.href ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              )}
            >
              <Link href={item.href} className="flex items-center gap-2 p-2">
                <item.icon className="h-5 w-5" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
