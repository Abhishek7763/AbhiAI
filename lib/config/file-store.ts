import fs from 'fs';
import path from 'path';

export const FILE_STORE_UNAVAILABLE_MESSAGE =
  'Persistent configuration storage is not available in this deployment yet.';

function resolveStorePath(fileName: string): string {
  return path.join(process.cwd(), fileName);
}

export function readJsonFile<T>(fileName: string): T | null {
  const filePath = resolveStorePath(fileName);

  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    console.error(`Failed to read ${fileName}:`, error);
    return null;
  }
}

export function writeJsonFile<T>(fileName: string, value: T): boolean {
  // Vercel Functions run from a read-only deployment filesystem. Phase 2
  // replaces this compatibility store with persistent Supabase repositories.
  if (process.env.VERCEL === '1') return false;

  try {
    fs.writeFileSync(resolveStorePath(fileName), JSON.stringify(value, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`Failed to write ${fileName}:`, error);
    return false;
  }
}
