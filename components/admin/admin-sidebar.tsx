'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Boxes,
  Cpu,
  Bot,
  Activity,
  BarChart,
  FileText,
  Settings,
  Route,
  Sparkles,
} from 'lucide-react';
import { AbhiLogo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import AdminLogoutButton from '@/components/admin/admin-logout-button';

const NAV_ITEMS = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Admin AI', href: '/admin/chat', icon: MessageSquare },
  { name: 'Integrations', href: '/admin/providers', icon: Boxes },
  { name: 'Models', href: '/admin/models', icon: Cpu },
  { name: 'Smart Routing', href: '/admin/routing', icon: Route },
  { name: 'Public AI Aliases', href: '/admin/public-ai', icon: Sparkles },
  { name: 'Agents', href: '/admin/agents', icon: Bot },
  { name: 'Health', href: '/admin/health', icon: Activity },
  { name: 'Usage', href: '/admin/usage', icon: BarChart },
  { name: 'Instructions', href: '/admin/instructions', icon: FileText },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

type AdminSidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export default function AdminSidebar({ onNavigate, className = '' }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`w-64 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col h-full shrink-0 ${className}`}
    >
      <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-200 dark:border-zinc-800">
        <AbhiLogo variant="full" size="sm" href="/" />
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
          Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <item.icon
                className={`w-4 h-4 ${
                  isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
        <ThemeToggle />
        <AdminLogoutButton />
      </div>
    </aside>
  );
}
