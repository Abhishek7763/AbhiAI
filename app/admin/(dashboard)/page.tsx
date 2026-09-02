import { LayoutDashboard, Server, Cpu, Activity, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const stats = [
    { name: 'Providers Connected', value: '0', icon: Server, color: 'text-blue-500' },
    { name: 'Available Models', value: '0', icon: Cpu, color: 'text-purple-500' },
    { name: 'Healthy Models', value: '0', icon: Activity, color: 'text-emerald-500' },
    { name: 'API Errors (24h)', value: '0', icon: AlertTriangle, color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
          <LayoutDashboard className="w-6 h-6" />
          Dashboard Overview
        </h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        <h2 className="text-xl font-medium mb-4 text-zinc-900 dark:text-zinc-100">System Status</h2>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
          Welcome to the AbhiAI admin control center. The dashboard shell (Phase 4) is now active. 
          Use the sidebar to navigate through the different management modules.
          <br /><br />
          Next up: <b>Phase 5</b> will introduce the Provider Framework, allowing you to connect and test external AI providers.
        </p>
      </div>
    </div>
  );
}
