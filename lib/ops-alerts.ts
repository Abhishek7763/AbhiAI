import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

interface AlertContext {
  providerRecordId: string | null;
  apiKeyRecordId: string | null;
}

const FAILURE_WINDOW_MINUTES = 10;
const FAILURE_THRESHOLD = 3;
const DEDUPE_MINUTES = 30;

async function sendWebhook(payload: Record<string, unknown>) {
  const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.warn('Ops alert webhook returned a non-success status.', { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn('Ops alert webhook failed.', error);
    return false;
  }
}

async function recordAlert(args: {
  kind: 'provider_failures' | 'quota_near_limit';
  severity: 'warning' | 'critical';
  providerId: string | null;
  apiKeyId: string | null;
  message: string;
  dedupeKey: string;
}) {
  const supabase = createAdminClient();
  const dedupeSince = new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString();
  const { data: existing, error: readError } = await supabase
    .from('ops_alerts')
    .select('id')
    .eq('dedupe_key', args.dedupeKey)
    .gte('created_at', dedupeSince)
    .limit(1);

  if (readError) throw new Error(readError.message);
  if (existing?.length) return;

  const notified = await sendWebhook({
    app: 'AbhiAI',
    kind: args.kind,
    severity: args.severity,
    message: args.message,
    timestamp: new Date().toISOString(),
  });

  const { error: insertError } = await supabase.from('ops_alerts').insert({
    kind: args.kind,
    severity: args.severity,
    provider_id: args.providerId,
    api_key_id: args.apiKeyId,
    message: args.message,
    dedupe_key: args.dedupeKey,
    notified_at: notified ? new Date().toISOString() : null,
  });

  if (insertError) throw new Error(insertError.message);
}

async function evaluateProviderFailures(providerId: string) {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - FAILURE_WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await supabase
    .from('usage_events')
    .select('id', { head: true, count: 'exact' })
    .eq('provider_id', providerId)
    .in('status', ['error', 'aborted'])
    .gte('created_at', since);

  if (error) throw new Error(error.message);
  if ((count ?? 0) < FAILURE_THRESHOLD) return;

  const { data: provider } = await supabase.from('ai_providers').select('name, slug').eq('id', providerId).maybeSingle();
  const providerName = provider?.name ?? provider?.slug ?? 'Unknown provider';
  await recordAlert({
    kind: 'provider_failures',
    severity: (count ?? 0) >= FAILURE_THRESHOLD * 2 ? 'critical' : 'warning',
    providerId,
    apiKeyId: null,
    message: `${providerName} recorded ${count ?? 0} failed requests in the last ${FAILURE_WINDOW_MINUTES} minutes.`,
    dedupeKey: `provider_failures:${providerId}`,
  });
}

async function evaluateKeyQuota(apiKeyId: string) {
  const supabase = createAdminClient();
  const { data: keyRow, error: keyError } = await supabase
    .from('ai_api_keys')
    .select('daily_request_quota, quota_alert_percent, provider_id, ai_providers(name, slug)')
    .eq('id', apiKeyId)
    .maybeSingle();

  if (keyError) throw new Error(keyError.message);
  const quota = Number(keyRow?.daily_request_quota ?? 0);
  if (!quota) return;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase
    .from('usage_events')
    .select('id', { head: true, count: 'exact' })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', startOfDay.toISOString());

  if (countError) throw new Error(countError.message);
  const used = count ?? 0;
  const threshold = Number(keyRow?.quota_alert_percent ?? 80);
  const percent = Math.round((used / quota) * 100);
  if (percent < threshold) return;

  const provider = (keyRow as any)?.ai_providers;
  const providerName = provider?.name ?? provider?.slug ?? 'API key';
  await recordAlert({
    kind: 'quota_near_limit',
    severity: percent >= 95 ? 'critical' : 'warning',
    providerId: keyRow?.provider_id ?? null,
    apiKeyId,
    message: `${providerName} API key used ${used}/${quota} requests today (${percent}%).`,
    dedupeKey: `quota:${apiKeyId}:${startOfDay.toISOString().slice(0, 10)}`,
  });
}

export async function evaluateOpsAlerts(context: AlertContext, status: 'success' | 'error') {
  try {
    const checks: Promise<void>[] = [];
    if (status === 'error' && context.providerRecordId) checks.push(evaluateProviderFailures(context.providerRecordId));
    if (context.apiKeyRecordId) checks.push(evaluateKeyQuota(context.apiKeyRecordId));
    await Promise.all(checks);
  } catch (error) {
    logger.warn('Ops alert evaluation failed.', error);
  }
}
