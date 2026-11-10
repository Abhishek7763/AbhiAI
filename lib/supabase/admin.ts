import 'server-only';

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_AGENTS } from '@/lib/agents';
import { DEFAULT_APP_SETTINGS } from '@/lib/app-settings';
import { readJsonFile, writeJsonFile } from '@/lib/config/file-store';
import { DEFAULT_PUBLIC_ALIASES } from '@/lib/constants/aliases';
import { encryptApiKey } from '@/lib/security/api-key-crypto';

export class SupabaseAdminConfigurationError extends Error {}

const LOCAL_DB_FILE = '.abhiai-local-db.json';

type TableName =
  | 'admin_users'
  | 'app_settings'
  | 'system_instructions'
  | 'instruction_revisions'
  | 'ai_agents'
  | 'ai_providers'
  | 'ai_api_keys'
  | 'ai_models'
  | 'usage_events'
  | 'ops_alerts';

type LocalDatabase = Record<TableName, Array<Record<string, any>>>;

let memoryDb: LocalDatabase | null = null;

function createSeedDatabase(): LocalDatabase {
  const now = new Date().toISOString();
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || '';
  const googleProviderId = 'provider-google-default';

  const ai_providers: Array<Record<string, any>> = [
    {
      id: googleProviderId,
      slug: 'google',
      name: 'Google Gemini',
      base_url: 'https://generativelanguage.googleapis.com',
      adapter_type: 'google',
      is_active: true,
      priority: 1,
      created_at: now,
    },
  ];

  const ai_api_keys: Array<Record<string, any>> = [];
  if (geminiKey) {
    try {
      const encrypted = encryptApiKey(geminiKey);
      ai_api_keys.push({
        id: 'key-google-default',
        provider_id: googleProviderId,
        label: 'Google Gemini key',
        encrypted_key: encrypted.encryptedKey,
        encryption_iv: encrypted.iv,
        encryption_tag: encrypted.tag,
        encryption_version: encrypted.version,
        key_fingerprint: encrypted.fingerprint,
        masked_key: encrypted.maskedKey,
        status: 'active',
        priority: 1,
        created_at: now,
      });
    } catch {
      // Ignore seed key encryption failure
    }
  }

  const ai_models: Array<Record<string, any>> = [
    {
      id: 'model-gemini-2-5-flash',
      provider_id: googleProviderId,
      model_id: 'gemini-2.5-flash',
      name: 'Google Gemini - Gemini 2.5 Flash',
      alias: 'AbhiAI Fast',
      capabilities: ['text', 'vision', 'reasoning', 'fast', 'coding'],
      is_active: true,
      is_public: true,
      is_free: true,
      priority: 1,
      limits: {},
      input_cost_per_million: 0,
      output_cost_per_million: 0,
      created_at: now,
    },
    {
      id: 'model-gemini-2-5-pro',
      provider_id: googleProviderId,
      model_id: 'gemini-2.5-pro',
      name: 'Google Gemini - Gemini 2.5 Pro',
      alias: 'AbhiAI Reasoning',
      capabilities: ['text', 'vision', 'reasoning', 'coding'],
      is_active: true,
      is_public: true,
      is_free: true,
      priority: 2,
      limits: {},
      input_cost_per_million: 0,
      output_cost_per_million: 0,
      created_at: now,
    },
  ];

  const defaultAliasMappings = DEFAULT_PUBLIC_ALIASES.map((alias) => ({
    ...alias,
    modelRecordId: alias.id === 'abhiai-think' ? 'model-gemini-2-5-pro' : 'model-gemini-2-5-flash',
    enabled: true,
  }));

  return {
    admin_users: [
      { id: 'local-admin-owner', email: process.env.ADMIN_EMAIL || 'abhigt6t@gmail.com', created_at: now },
      { id: 'local-admin-abhishek', email: 'abhishekbhardwaj7763@gmail.com', created_at: now },
    ],
    app_settings: [
      {
        key: 'general',
        value: DEFAULT_APP_SETTINGS,
        description: 'AbhiAI application settings.',
      },
      {
        key: 'routing',
        value: {
          strategy: 'smart-auto',
          preferredModelRecordId: 'model-gemini-2-5-flash',
          poolModelRecordIds: ['model-gemini-2-5-flash', 'model-gemini-2-5-pro'],
          strictPool: false,
          failoverEnabled: true,
          maxAttempts: 4,
          providerTimeoutMs: 35000,
        },
        description: 'AbhiAI Smart Auto pool.',
      },
      {
        key: 'public_aliases',
        value: defaultAliasMappings,
        description: 'Public AbhiAI aliases mapped to backend model records.',
      },
    ],
    system_instructions: [
      {
        id: 'global',
        system_prompt:
          'You are AbhiAI, a helpful, accurate, and thoughtful AI assistant created by Abhishek. Provide clear, well-structured responses.',
        updated_at: now,
      },
      {
        id: 'public',
        system_prompt: 'Keep answers concise, accurate, and friendly for public visitors.',
        updated_at: now,
      },
      {
        id: 'admin',
        system_prompt: 'Provide deep technical detail and full diagnostics for admin sessions.',
        updated_at: now,
      },
    ],
    instruction_revisions: [],
    ai_agents: DEFAULT_AGENTS.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      system_prompt: agent.systemPrompt,
      preferred_model_alias: agent.preferredModelOrAlias || null,
      model_pool: agent.modelPool ?? (agent.preferredModelOrAlias ? [agent.preferredModelOrAlias] : []),
      fallback_model_alias: agent.fallbackModelOrAlias || null,
      required_capabilities: agent.requiredCapabilities,
      allowed_tools: agent.allowedTools ?? ['web_search', 'document_qa'],
      visibility: agent.visibility,
      temperature: agent.temperature,
      memory_enabled: agent.memoryEnabled !== false,
      max_tokens: agent.maxTokens ?? 4096,
      sample_starters: agent.sampleStarters ?? [],
      created_at: agent.createdAt || now,
    })),
    ai_providers,
    ai_api_keys,
    ai_models,
    usage_events: [],
    ops_alerts: [],
  };
}

function loadLocalDb(): LocalDatabase {
  if (memoryDb) return memoryDb;
  const disk = readJsonFile<LocalDatabase>(LOCAL_DB_FILE);
  if (disk && typeof disk === 'object' && Array.isArray(disk.ai_providers)) {
    memoryDb = {
      ...createSeedDatabase(),
      ...disk,
    };
    return memoryDb;
  }
  memoryDb = createSeedDatabase();
  writeJsonFile(LOCAL_DB_FILE, memoryDb);
  return memoryDb;
}

function saveLocalDb(db: LocalDatabase) {
  memoryDb = db;
  writeJsonFile(LOCAL_DB_FILE, db);
}

function attachRelations(table: TableName, row: Record<string, any>, selectSpec: string, db: LocalDatabase) {
  const clone: Record<string, any> = { ...row };
  if (table === 'ai_models' && selectSpec.includes('ai_providers')) {
    const provider = db.ai_providers.find((p) => p.id === row.provider_id) ?? null;
    if (provider) {
      const providerClone: Record<string, any> = { ...provider };
      if (selectSpec.includes('ai_api_keys')) {
        providerClone.ai_api_keys = db.ai_api_keys
          .filter((k) => k.provider_id === provider.id)
          .map((k) => ({ ...k }));
      }
      clone.ai_providers = providerClone;
    } else {
      clone.ai_providers = null;
    }
  } else if (table === 'ai_providers' && selectSpec.includes('ai_api_keys')) {
    clone.ai_api_keys = db.ai_api_keys
      .filter((k) => k.provider_id === row.id)
      .map((k) => ({ ...k }));
  } else if (table === 'ai_api_keys' && selectSpec.includes('ai_providers')) {
    const provider = db.ai_providers.find((p) => p.id === row.provider_id) ?? null;
    clone.ai_providers = provider ? { ...provider } : null;
  } else if (table === 'usage_events') {
    if (selectSpec.includes('ai_providers')) {
      const provider = db.ai_providers.find((p) => p.id === row.provider_id) ?? null;
      clone.ai_providers = provider ? { ...provider } : null;
    }
    if (selectSpec.includes('ai_models')) {
      const model = db.ai_models.find((m) => m.id === row.model_id) ?? null;
      clone.ai_models = model ? { ...model } : null;
    }
  }
  return clone;
}

function createLocalQueryBuilder(table: TableName) {
  let operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  let selectSpec = '*';
  let selectOptions: { head?: boolean; count?: 'exact' } | undefined;
  let mutationPayload: any = null;
  let upsertConflict: string | undefined;
  const filters: Array<(row: Record<string, any>) => boolean> = [];
  const orders: Array<{ column: string; ascending: boolean }> = [];
  let rowLimit: number | null = null;
  let singleMode: 'none' | 'single' | 'maybeSingle' = 'none';

  const execute = () => {
    const db = loadLocalDb();
    const list = db[table] ?? [];

    if (operation === 'insert') {
      const items = Array.isArray(mutationPayload) ? mutationPayload : [mutationPayload];
      const inserted: Array<Record<string, any>> = [];
      for (const item of items) {
        const now = new Date().toISOString();
        const defaultId =
          table === 'instruction_revisions' || table === 'usage_events'
            ? list.length + 1
            : randomUUID();
        const newRow: Record<string, any> = {
          ...(table !== 'app_settings' ? { id: item.id ?? defaultId } : {}),
          created_at: item.created_at ?? now,
          updated_at: item.updated_at ?? now,
          ...(table === 'ai_providers' ? { priority: item.priority ?? list.length + 1 } : {}),
          ...(table === 'ai_api_keys' ? { priority: item.priority ?? 1 } : {}),
          ...(table === 'ai_models'
            ? {
                priority: item.priority ?? list.length + 1,
                capabilities: item.capabilities ?? ['text', 'fast'],
                limits: item.limits ?? {},
              }
            : {}),
          ...item,
        };
        list.push(newRow);
        inserted.push(attachRelations(table, newRow, selectSpec, db));
      }
      db[table] = list;
      saveLocalDb(db);
      const data =
        singleMode === 'single' || singleMode === 'maybeSingle'
          ? inserted[0] ?? null
          : inserted;
      return { data, error: null };
    }

    if (operation === 'upsert') {
      const items = Array.isArray(mutationPayload) ? mutationPayload : [mutationPayload];
      const defaultConflict =
        table === 'app_settings'
          ? 'key'
          : table === 'ai_providers'
            ? 'slug'
            : 'id';
      const conflictCols = (upsertConflict || defaultConflict)
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const upserted: Array<Record<string, any>> = [];
      for (const item of items) {
        const now = new Date().toISOString();
        const existingIndex = list.findIndex((row) =>
          conflictCols.every((col) => row[col] !== undefined && item[col] !== undefined && row[col] === item[col]),
        );
        if (existingIndex >= 0) {
          const updatedRow = {
            ...list[existingIndex],
            ...item,
            updated_at: now,
          };
          list[existingIndex] = updatedRow;
          upserted.push(attachRelations(table, updatedRow, selectSpec, db));
        } else {
          const newRow: Record<string, any> = {
            ...(table !== 'app_settings' ? { id: item.id ?? randomUUID() } : {}),
            created_at: item.created_at ?? now,
            updated_at: now,
            ...(table === 'ai_providers' ? { priority: item.priority ?? list.length + 1 } : {}),
            ...(table === 'ai_api_keys' ? { priority: item.priority ?? 1 } : {}),
            ...(table === 'ai_models'
              ? {
                  priority: item.priority ?? list.length + 1,
                  capabilities: item.capabilities ?? ['text', 'fast'],
                  limits: item.limits ?? {},
                }
              : {}),
            ...item,
          };
          list.push(newRow);
          upserted.push(attachRelations(table, newRow, selectSpec, db));
        }
      }
      db[table] = list;
      saveLocalDb(db);
      const data =
        singleMode === 'single' || singleMode === 'maybeSingle'
          ? upserted[0] ?? null
          : upserted;
      return { data, error: null };
    }

    if (operation === 'update') {
      const now = new Date().toISOString();
      const updatedRows: Array<Record<string, any>> = [];
      db[table] = list.map((row) => {
        if (filters.every((fn) => fn(row))) {
          const updated = { ...row, ...mutationPayload, updated_at: now };
          updatedRows.push(attachRelations(table, updated, selectSpec, db));
          return updated;
        }
        return row;
      });
      saveLocalDb(db);
      const data =
        singleMode === 'single' || singleMode === 'maybeSingle'
          ? updatedRows[0] ?? null
          : updatedRows;
      return { data, error: null };
    }

    if (operation === 'delete') {
      db[table] = list.filter((row) => !filters.every((fn) => fn(row)));
      saveLocalDb(db);
      return { data: null, error: null };
    }

    // SELECT
    let matched = list.filter((row) => filters.every((fn) => fn(row)));

    if (selectOptions?.head && selectOptions?.count === 'exact') {
      return { data: null, count: matched.length, error: null };
    }

    if (orders.length > 0) {
      matched = [...matched].sort((a, b) => {
        for (const ord of orders) {
          const av = a[ord.column];
          const bv = b[ord.column];
          if (av === bv) continue;
          if (av === undefined || av === null) return 1;
          if (bv === undefined || bv === null) return -1;
          const cmp = av < bv ? -1 : 1;
          return ord.ascending ? cmp : -cmp;
        }
        return 0;
      });
    }

    if (rowLimit !== null) {
      matched = matched.slice(0, rowLimit);
    }

    const mapped = matched.map((row) => attachRelations(table, row, selectSpec, db));

    if (singleMode === 'single') {
      if (mapped.length === 0) {
        return { data: null, error: { message: `No ${table} record found.` } };
      }
      return { data: mapped[0], error: null };
    }

    if (singleMode === 'maybeSingle') {
      return { data: mapped[0] ?? null, error: null };
    }

    return { data: mapped, error: null };
  };

  const builder: any = {
    select(columns = '*', options?: { head?: boolean; count?: 'exact' }) {
      selectSpec = columns;
      selectOptions = options;
      return builder;
    },
    insert(payload: any) {
      operation = 'insert';
      mutationPayload = payload;
      return builder;
    },
    upsert(payload: any, options?: { onConflict?: string }) {
      operation = 'upsert';
      mutationPayload = payload;
      upsertConflict = options?.onConflict;
      return builder;
    },
    update(payload: any) {
      operation = 'update';
      mutationPayload = payload;
      return builder;
    },
    delete() {
      operation = 'delete';
      return builder;
    },
    eq(column: string, value: any) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    in(column: string, values: any[]) {
      const set = new Set(values);
      filters.push((row) => set.has(row[column]));
      return builder;
    },
    gte(column: string, value: any) {
      filters.push((row) => row[column] >= value);
      return builder;
    },
    order(column: string, options?: { ascending?: boolean }) {
      orders.push({ column, ascending: options?.ascending !== false });
      return builder;
    },
    limit(n: number) {
      rowLimit = n;
      return builder;
    },
    single() {
      singleMode = 'single';
      return Promise.resolve(execute());
    },
    maybeSingle() {
      singleMode = 'maybeSingle';
      return Promise.resolve(execute());
    },
    then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any) {
      return Promise.resolve(execute()).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

function createLocalAdminClient(): any {
  return {
    from(table: TableName) {
      return createLocalQueryBuilder(table);
    },
    async rpc(fnName: string, args: Record<string, any>) {
      if (fnName === 'check_public_rate_limit') {
        const rpm = Number(args.p_rpm || 30);
        const daily = Number(args.p_daily || 200);
        return {
          data: [
            {
              allowed: true,
              minute_count: 1,
              daily_count: 1,
              minute_limit: rpm,
              daily_limit: daily,
              retry_after_seconds: 0,
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };
}

export function isSupabaseAdminConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return Boolean(url && secret && !url.includes('placeholder.supabase.co'));
}

function createRealAdminClient(url: string, secret: string) {
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

  if (!url || !secret || url.includes('placeholder.supabase.co')) {
    return createLocalAdminClient() as unknown as ReturnType<typeof createRealAdminClient>;
  }

  return createRealAdminClient(url, secret);
}
