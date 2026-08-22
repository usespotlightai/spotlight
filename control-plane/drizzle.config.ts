import 'dotenv/config';
import { parseEnv } from '@infrastructure/config/env';
import { defineConfig } from 'drizzle-kit';

const env = parseEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/persistence/drizzle/schemas/index.ts',
  out: './drizzle',
  migrations: {
    prefix: 'timestamp',
  },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
