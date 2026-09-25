export const E2E_DATABASE = 'spotlight_e2e';

export const databaseNamed = (url: string, database: string): string =>
  url.replace(/\/[^/?]*(\?|$)/, `/${database}$1`);
