import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ImportResult, ImportTarget } from '@youscan/shared';
import { unprocessable } from '../http/errors.js';
import {
  ImportKeyTakenError,
  type NewWidget,
  type OnExistingSource,
  type StoredImport,
  type WidgetsRepository,
} from '../widgets/widgets.repository.js';
import { extractWidgets, type SourceFile } from './extract-widgets.js';
import type { ParserRegistry } from './parsers/parser-registry.js';
import { loadSeedManifest } from './seed-manifest.js';

export interface ImportOutcome {
  result: ImportResult;
  /** True when the result was stored by an earlier request with the same idempotency key. */
  replayed: boolean;
}

function fingerprintOf(file: SourceFile, targets: readonly ImportTarget[]): string {
  const content = createHash('sha256').update(file.content).digest('hex');
  return createHash('sha256').update(JSON.stringify({ name: file.name, content, targets })).digest('hex');
}

function replay(stored: StoredImport, fingerprint: string): ImportOutcome {
  if (stored.fingerprint !== fingerprint) {
    throw unprocessable('Idempotency-Key has already been used for a different request');
  }
  return { result: stored.result, replayed: true };
}

/**
 * The single entry point for importing files into widgets, shared by the HTTP upload
 * (`POST /api/import`) and the seed command. Everything is parsed and validated before the first write, and
 * all widgets of one call are saved in one transaction.
 */
export class IngestionService {
  constructor(
    private readonly widgets: WidgetsRepository,
    private readonly parsers: ParserRegistry,
  ) {}

  async importFile(file: SourceFile, targets: readonly ImportTarget[]): Promise<ImportResult> {
    const extracted = await extractWidgets(this.parsers, file, targets);
    return { widgets: await this.widgets.saveMany(extracted, 'skip') };
  }

  /**
   * `importFile` made safe to retry: the first request with `key` imports and stores its result;
   * a repeat of the same request (same file name, content and targets), even a concurrent one,
   * gets that result back without importing again. A failed import stores nothing, so it can be
   * retried with the same key.
   * @throws HttpError 422 if `key` was already used for a different request.
   */
  async importFileOnce(file: SourceFile, targets: readonly ImportTarget[], key: string): Promise<ImportOutcome> {
    const fingerprint = fingerprintOf(file, targets);
    const stored = await this.widgets.findImport(key);
    if (stored) return replay(stored, fingerprint);

    const extracted = await extractWidgets(this.parsers, file, targets);
    try {
      return { result: { widgets: await this.widgets.saveMany(extracted, 'skip', { key, fingerprint }) }, replayed: false };
    } catch (error) {
      // Lost the race to a concurrent request with the same key, whose import has committed.
      const winner = error instanceof ImportKeyTakenError ? await this.widgets.findImport(key) : null;
      if (winner) return replay(winner, fingerprint);
      throw error;
    }
  }

  /**
   * Imports every manifest entry. Existing widgets (matched by `sourceKey`) are kept as is,
   * so re-running never duplicates widgets or overwrites edits, unless `onExisting` is
   * "replace".
   */
  async seed(manifestPath: string, onExisting: OnExistingSource = 'skip'): Promise<ImportResult> {
    const manifest = await loadSeedManifest(manifestPath);
    const files = new Map<string, Promise<SourceFile>>();
    const load = (path: string) => {
      if (!files.has(path)) files.set(path, readFile(path).then((content) => ({ name: basename(path), content })));
      return files.get(path)!;
    };

    const widgets: NewWidget[] = [];
    for (const { sourceKey, file, ...target } of manifest.entries) {
      const source = await load(manifest.resolveFile(file));
      const [extracted] = await extractWidgets(this.parsers, source, [target]);
      widgets.push({ ...extracted!, sourceKey });
    }
    return { widgets: await this.widgets.saveMany(widgets, onExisting) };
  }
}
