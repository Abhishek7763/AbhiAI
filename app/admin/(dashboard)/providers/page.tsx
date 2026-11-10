import { Boxes } from 'lucide-react';
import ProviderIntegrationsPanel from '@/components/admin/provider-integrations-panel';
import { PROVIDER_TEMPLATES } from '@/lib/ai/providers/registry';
import { listProviders } from '@/lib/data/ai-config';

export default async function ProvidersPage() {
  const providers = await listProviders();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Integrations</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
              Add AI providers, save encrypted API keys, test connectivity and discover/import models from one place.
            </p>
          </div>
        </div>
      </div>

      <ProviderIntegrationsPanel
        templates={PROVIDER_TEMPLATES}
        initialProviders={providers as any}
      />
    </div>
  );
}
