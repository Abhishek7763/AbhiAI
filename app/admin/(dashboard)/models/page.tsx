import { Cpu } from 'lucide-react';
import { ModelBrandingPanel } from '@/components/admin/model-branding-panel';
import { getStoredModels } from '@/lib/data/admin-config';

export default async function ModelsPage() {
  const models = await getStoredModels();

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            <Cpu className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Models</h1>
        </div>
        <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400 sm:text-base">
          Manage imported models in one place. Rename them, enable or disable them, and control whether they are public-facing.
        </p>
      </div>

      <ModelBrandingPanel initialModels={models} />
    </div>
  );
}
