import { idempotencyKeySchema, importTargetsSchema } from '@youscan/shared';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { IngestionService } from '../ingestion/ingestion.service.js';
import { badRequest } from './errors.js';
import { parseWith } from './validate.js';

/** Multipart text fields arrive as strings: `targets` is a JSON-encoded array. */
const importBodySchema = z.object({
  targets: z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'targets must be valid JSON' });
        return z.NEVER;
      }
    })
    .pipe(importTargetsSchema),
});

/**
 * POST /import, multipart/form-data:
 * - `file`: .xlsx or .csv, at most `maxUploadBytes` (413 otherwise)
 * - `targets`: JSON array of `{ widgetType, title, sheet?, mapping }`, one per widget to create.
 *
 * Optional `Idempotency-Key` header: a repeat of the same request returns the first response
 * (with `Idempotent-Replayed: true`) instead of importing again; 422 if the key was used for a
 * different request.
 */
export function importRouter(ingestion: IngestionService, maxUploadBytes: number): Router {
  const router = Router();
  // Files are held in memory and parsed in-process; see MAX_UPLOAD_SIZE_BYTES in config.ts.
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes, files: 1 } });

  router.post('/import', upload.single('file'), async (req, res) => {
    const { targets } = parseWith(importBodySchema, req.body ?? {});
    const key = req.get('Idempotency-Key');
    if (!req.file) throw badRequest('A "file" field is required');
    const file = { name: req.file.originalname, content: req.file.buffer };

    if (key === undefined) {
      res.status(201).json(await ingestion.importFile(file, targets));
      return;
    }
    const { result, replayed } = await ingestion.importFileOnce(file, targets, parseWith(idempotencyKeySchema, key));
    if (replayed) res.set('Idempotent-Replayed', 'true');
    res.status(201).json(result);
  });

  return router;
}
