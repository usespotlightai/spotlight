import 'dotenv/config';
import { parseDatabaseEnv } from '@infrastructure/config/env';
import { defineConfig } from 'drizzle-kit';

const env = parseDatabaseEnv();

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
