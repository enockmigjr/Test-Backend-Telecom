import { promises as fs } from 'fs';
import * as path from 'path';

export async function listFilesOlderThan(root: string, olderThan: Date): Promise<string[]> {
  const files: string[] = [];
  await visit(root, root, olderThan, files);
  return files;
}

async function visit(root: string, directory: string, olderThan: Date, files: string[]): Promise<void> {
  let entries;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- racine validée par LocalStorageService
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isErrorCode(error, 'ENOENT')) return;
    throw error;
  }
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(root, entryPath, olderThan, files);
      continue;
    }
    if (!entry.isFile()) continue;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- entrée issue de readdir sous la racine validée
    const metadata = await fs.stat(entryPath);
    if (metadata.mtime >= olderThan) continue;
    files.push(`quarantine/${path.relative(root, entryPath).replace(/\\/g, '/')}`);
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
