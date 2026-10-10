import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { dataFile } from './helpers.js';

const env = (extra: Record<string, string> = {}) => ({ DATABASE_URL: 'postgresql://localhost/db', ...extra });

describe('loadConfig: MAX_UPLOAD_SIZE_BYTES', () => {
  it('defaults to 5 MiB', () => {
    expect(loadConfig(env()).MAX_UPLOAD_SIZE_BYTES).toBe(5_242_880);
  });

  it('reads the value from the environment string', () => {
    expect(loadConfig(env({ MAX_UPLOAD_SIZE_BYTES: '1048576' })).MAX_UPLOAD_SIZE_BYTES).toBe(1_048_576);
    expect(loadConfig(env({ MAX_UPLOAD_SIZE_BYTES: '52428800' })).MAX_UPLOAD_SIZE_BYTES).toBe(52_428_800);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '52428801'])('rejects %j at startup', (value) => {
    expect(() => loadConfig(env({ MAX_UPLOAD_SIZE_BYTES: value }))).toThrow(/Invalid environment[\s\S]*MAX_UPLOAD_SIZE_BYTES/);
  });
});

describe('loadConfig: SEED_MANIFEST', () => {
  it("defaults to the repository's data/seed-manifest.json", () => {
    expect(loadConfig(env()).SEED_MANIFEST).toBe(dataFile('seed-manifest.json'));
  });

  it('reads the value from the environment', () => {
    expect(loadConfig(env({ SEED_MANIFEST: '/tmp/manifest.json' })).SEED_MANIFEST).toBe('/tmp/manifest.json');
  });

  it('rejects an empty path', () => {
    expect(() => loadConfig(env({ SEED_MANIFEST: '' }))).toThrow(/SEED_MANIFEST/);
  });
});
