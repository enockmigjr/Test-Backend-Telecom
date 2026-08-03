/* eslint-disable security/detect-non-literal-fs-filename -- chemins confinés dans le dossier mkdtemp de chaque test */
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { listFilesOlderThan } from './quarantine-inventory';

describe('listFilesOlderThan', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(tmpdir(), 'telecom-quarantine-'));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('retourne uniquement les fichiers anciens avec une clé portable', async () => {
    const nested = path.join(directory, 'attachments', 'public');
    await fs.mkdir(nested, { recursive: true });
    const oldFile = path.join(nested, 'old.pdf');
    const recentFile = path.join(nested, 'recent.pdf');
    await fs.writeFile(oldFile, 'old');
    await fs.writeFile(recentFile, 'recent');
    const oldDate = new Date('2025-01-01T00:00:00.000Z');
    await fs.utimes(oldFile, oldDate, oldDate);

    const result = await listFilesOlderThan(directory, new Date('2026-01-01T00:00:00.000Z'));

    expect(result).toEqual(['quarantine/attachments/public/old.pdf']);
  });

  it('parcourt tous les fichiers anciens sans suivre les entrées non-fichier', async () => {
    await fs.writeFile(path.join(directory, 'first.txt'), 'first');
    await fs.writeFile(path.join(directory, 'second.txt'), 'second');

    const result = await listFilesOlderThan(directory, new Date(Date.now() + 1_000));

    expect(result).toHaveLength(2);
  });
});
