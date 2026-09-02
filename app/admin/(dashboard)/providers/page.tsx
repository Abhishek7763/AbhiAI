import { Boxes } from 'lucide-react';
import GoogleProviderPanel from '@/components/admin/google-provider-panel';
import { listProviders } from '@/lib/data/ai-config';

export default async function ProvidersPage() {
  const providers = await listProviders();
  const google = providers.find((provider) => provider.slug === 'google');
  const activeKeyCount = (google?.ai_api_keys ?? []).filter((key) => key.status === 'active').length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Providers</h1>
        </div>
        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
          Connect and verify AI providers from the protected admin area. Phase 5 intentionally starts with Google Gemini only so the full provider flow can be proven before more providers are added.
        </p>
      </div>

      <GoogleProviderPanel activeKeyCount={activeKeyCount} />
    </div>
  );
}
