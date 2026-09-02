import { redirect } from 'next/navigation';

export default function LegacyPublicAIPage() {
  redirect('/admin/settings');
}
