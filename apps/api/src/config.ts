import { z } from 'zod';

const MiB = 1024 * 1024;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  // Uploads are held in memory and parsed in-process, so the cap stays well below a small
  // instance's RAM (512 MB on Render's free plan).
  MAX_UPLOAD_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * MiB)
    .default(5 * MiB),
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
