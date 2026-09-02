import AdminSidebar from '@/components/admin/admin-sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // NOTE: Authentication is currently bypassed for development as requested by the user.
  // Will be re-enabled during production deployment.
  
  return (
    <div className="flex h-screen bg-zinc-50/70 dark:bg-zinc-950/70 backdrop-blur-xs overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
