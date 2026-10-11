// `npm run setup`: creates apps/api/.env from .env.example on first run; never overwrites it.
import { copyFileSync, existsSync } from 'node:fs';

const env = new URL('../apps/api/.env', import.meta.url);
if (existsSync(env)) {
  console.log('apps/api/.env exists, keeping it');
} else {
  copyFileSync(new URL('../apps/api/.env.example', import.meta.url), env);
  console.log('Created apps/api/.env from .env.example; adjust DATABASE_URL if needed');
}
