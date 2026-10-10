import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { importTargetSchema } from '@youscan/shared';
import { z } from 'zod';
import { IngestionError } from './ingestion.errors.js';

export const seedEntrySchema = importTargetSchema.extend({
  /** Stable logical id, e.g. "initial-dashboard#line". Independent of the file name. */
  sourceKey: z.string().min(1),
  /** Path relative to the manifest file. */
  file: z.string().min(1),
});
export type SeedEntry = z.infer<typeof seedEntrySchema>;

export const seedManifestSchema = z
  .array(seedEntrySchema)
  .min(1)
  .refine((entries) => new Set(entries.map((e) => e.sourceKey)).size === entries.length, 'sourceKey must be unique');

export interface LoadedManifest {
  entries: SeedEntry[];
  /** Absolute path of an entry's `file`. */
  resolveFile(file: string): string;
}

export async function loadSeedManifest(path: string): Promise<LoadedManifest> {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new IngestionError(`Cannot read seed manifest ${path}: ${(error as Error).message}`);
  }
  const result = seedManifestSchema.safeParse(json);
  if (!result.success) throw new IngestionError(`Invalid seed manifest ${path}:\n${z.prettifyError(result.error)}`);

  const baseDir = dirname(resolve(path));
  return { entries: result.data, resolveFile: (file) => resolve(baseDir, file) };
}
