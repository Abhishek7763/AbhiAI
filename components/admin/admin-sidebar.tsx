'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MessageSquare, Server, Bot,
  Globe, Activity, BarChart, FileText, Settings, LogOut
} from 'lucide-react';
import { logout } from '@/app/admin/actions';
import { AbhiLogo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const NAV_ITEMS = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'AI Chat', href: '/admin/chat', icon: MessageSquare },
  { name: 'AI Connections', href: '/admin/connections', icon: Server },
  { name: 'Agents', href: '/admin/agents', icon: Bot },
  { name: 'Public AI', href: '/admin/public-ai', icon: Globe },
  { name: 'Health', href: '/admin/health', icon: Activity },
  { name: 'Usage', href: '/admin/usage', icon: BarChart },
  { name: 'Instructions', href: '/admin/instructions', icon: FileText },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  
  return (
    <div className="w-64 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-r border-zinc-200/80 dark:border-zinc-800/80 flex flex-col h-full shrink-0">
      <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-200 dark:border-zinc-800">
        <AbhiLogo variant="full" size="sm" href="/" />
        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
          Admin
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`} />
              {item.name}
            </Link>
          );
        })}
      </div>
      
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
        <ThemeToggle />
        <form action={logout}>
          <button type="submit" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
