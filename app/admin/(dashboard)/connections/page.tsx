import { redirect } from 'next/navigation';

export default function LegacyConnectionsPage() {
  redirect('/admin/providers');
}
