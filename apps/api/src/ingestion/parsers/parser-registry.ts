import { extname } from 'node:path';
import { UnsupportedFileTypeError } from '../ingestion.errors.js';
import { CsvParser } from './csv.parser.js';
import type { FileParser } from './file-parser.js';
import { XlsxParser } from './xlsx.parser.js';

/** Picks a parser by file extension. Supporting a new format = adding a parser here. */
export class ParserRegistry {
  private readonly byExtension = new Map<string, FileParser>();

  constructor(parsers: readonly FileParser[] = [new XlsxParser(), new CsvParser()]) {
    for (const parser of parsers) {
      for (const ext of parser.extensions) this.byExtension.set(ext, parser);
    }
  }

  get supportedExtensions(): string[] {
    return [...this.byExtension.keys()];
  }

  forFile(fileName: string): FileParser {
    const parser = this.byExtension.get(extname(fileName).toLowerCase());
    if (!parser) throw new UnsupportedFileTypeError(fileName, this.supportedExtensions);
    return parser;
  }
}
