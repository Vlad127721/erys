import { fileURLToPath } from 'node:url';

/**
 * The repository's `data/` folder (provided XLSX/CSV files and the seed manifest). Resolved from
 * this module, which sits at the same depth in `src/` and `dist/`: apps/api/{src,dist}/paths.
 */
export const DATA_DIR = fileURLToPath(new URL('../../../data/', import.meta.url));
