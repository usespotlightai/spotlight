export const E2E_DATABASE =
  process.env.SPOTLIGHT_E2E_DATABASE ?? 'spotlight_e2e';

export const E2E_SERVER =
  process.env.SPOTLIGHT_E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/postgres';

export const E2E_TEMPLATE = `${E2E_DATABASE}_template`;

export const isE2eDatabase = (database: string): boolean =>
  database === E2E_DATABASE || database.startsWith(`${E2E_DATABASE}_`);

export const databaseNamed = (url: string, database: string): string =>
  url.replace(/\/[^/?]*(\?|$)/, `/${database}$1`);
