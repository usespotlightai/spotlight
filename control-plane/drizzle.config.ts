import 'dotenv/config';
import { parseDatabaseEnv } from '@platform/config/env';
import { defineConfig } from 'drizzle-kit';

const env = parseDatabaseEnv();

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/platform/persistence/drizzle/schemas/*.schema.ts',
    './src/contexts/*/infrastructure/persistence/drizzle/schemas/*.schema.ts',
  ],
  out: './drizzle',
  migrations: {
    prefix: 'timestamp',
  },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
