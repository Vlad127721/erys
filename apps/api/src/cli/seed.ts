import { parseArgs } from 'node:util';
import { loadConfig } from '../config.js';
import { createContainer } from '../container.js';
import { IngestionError } from '../ingestion/ingestion.errors.js';

/**
 * Imports the initial dashboard described by the seed manifest.
 *
 *   npm run db:seed                      # insert widgets that are not there yet
 *   npm run db:seed -- --replace         # also overwrite existing ones with fresh file data
 *   npm run db:seed -- --manifest path   # use another manifest (default: SEED_MANIFEST, see config.ts)
 */
const config = loadConfig();
const { values } = parseArgs({
  options: {
    manifest: { type: 'string', default: config.SEED_MANIFEST },
    replace: { type: 'boolean', default: false },
  },
});

const { prisma, ingestion } = createContainer(config);
try {
  const result = await ingestion.seed(values.manifest, values.replace ? 'replace' : 'skip');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  if (!(error instanceof IngestionError)) throw error;
  console.error(`Import failed: ${error.message}`);
  if (error.details !== undefined) console.error(JSON.stringify(error.details, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
