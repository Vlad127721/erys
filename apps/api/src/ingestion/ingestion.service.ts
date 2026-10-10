import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ImportResult, ImportTarget } from '@youscan/shared';
import type { NewWidget, OnExistingSource, WidgetsRepository } from '../widgets/widgets.repository.js';
import { extractWidgets, type SourceFile } from './extract-widgets.js';
import type { ParserRegistry } from './parsers/parser-registry.js';
import { loadSeedManifest } from './seed-manifest.js';

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
