import { join } from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from './paths.js';

const MiB = 1024 * 1024;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  // Uploads are held in memory and parsed in-process, so the cap stays well below a small
  // instance's RAM. On Vercel, function request bodies are capped at 4.5 MB anyway.
  MAX_UPLOAD_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * MiB)
    .default(5 * MiB),
  // Manifest used by `npm run db:seed`; `--manifest <path>` overrides it per run.
  SEED_MANIFEST: z.string().min(1).default(join(DATA_DIR, 'seed-manifest.json')),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Fails fast at startup with a readable message instead of failing on first query. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
