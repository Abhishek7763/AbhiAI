import Link from 'next/link';
import { Activity, ArrowRight, Boxes, Cpu, LayoutDashboard, Route } from 'lucide-react';
import { classifyModelBilling } from '@/lib/ai/free-guard';
import { getStoredModels } from '@/lib/data/admin-config';
import { listProviders } from '@/lib/data/ai-config';
import { getRoutingConfig } from '@/lib/data/routing-config';

export default async function AdminDashboard() {
  const [providers, models, routing] = await Promise.all([
    listProviders(),
    getStoredModels(),
    getRoutingConfig(),
  ]);

  const connectedProviders = providers.filter((provider: any) =>
    provider.is_active && (provider.ai_api_keys ?? []).some((key: any) => key.status === 'active'),
  ).length;
  const runtimeEligible = models.filter((model) => {
    if (!model.isActive) return false;
    const billing = classifyModelBilling(model.providerId, model.id);
    return billing === 'FREE_VERIFIED' || billing === 'FREE_LIMITED';
  }).length;

  const stats = [
    { name: 'Connected Integrations', value: connectedProviders, icon: Boxes, color: 'text-blue-500' },
    { name: 'Imported Models', value: models.length, icon: Cpu, color: 'text-purple-500' },
    { name: 'Smart Auto Pool', value: routing.poolModelRecordIds.length, icon: Route, color: 'text-emerald-500' },
    { name: 'Runtime Eligible', value: runtimeEligible, icon: Activity, color: 'text-amber-500' },
  ];

  const flow = [
    { step: '1', title: 'Integrations', detail: 'Add providers, encrypted API keys and discover models.', href: '/admin/providers' },
    { step: '2', title: 'Models', detail: 'Rename, enable/disable and control model visibility.', href: '/admin/models' },
    { step: '3', title: 'Smart Routing', detail: 'Build the AbhiAI Auto pool and routing policy.', href: '/admin/routing' },
    { step: '4', title: 'Health', detail: 'See which providers and models are healthy right now.', href: '/admin/health' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <LayoutDashboard className="w-6 h-6" />
          Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          A simple view of the current AbhiAI provider, model and routing setup.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <div className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{stat.value}</div>
            <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{stat.name}</div>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Simple admin flow</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Provider setup is now intentionally separated into four clear steps instead of duplicate connection screens.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {flow.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 transition hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {item.step}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  {item.title}
                  <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
