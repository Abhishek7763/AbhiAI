import AdminShell from '@/components/admin/admin-shell';
import { requireAdminPage } from '@/lib/security/admin-auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPage();

  return <AdminShell>{children}</AdminShell>;
}
