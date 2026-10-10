import { join } from 'node:path';
import { DATA_DIR } from '../src/paths.js';

export const dataFile = (name: string): string => join(DATA_DIR, name);
