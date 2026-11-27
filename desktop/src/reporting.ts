import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { init } from '@sentry/electron/main';
import { app, net } from 'electron';

const LEFT_OUT = new Set([
  'MainProcessSession',
  'BrowserWindowSession',
  'PreloadInjection',
  'ElectronNet',
]);

interface Reporting {
  readonly dsn: string;
  readonly environment: string | null;
}

const isReporting = (value: unknown): value is Reporting =>
  typeof value === 'object' &&
  value !== null &&
  'dsn' in value &&
  typeof value.dsn === 'string' &&
  value.dsn.startsWith('https://');

export class ErrorReporting {
  private readonly path: string;

  constructor(directory: string) {
    this.path = join(directory, 'error-reporting.json');
  }

  start(): void {
    let cached: unknown = null;

    try {
      cached = JSON.parse(readFileSync(this.path, 'utf8'));
    } catch {
      return;
    }

    if (!isReporting(cached)) {
      return;
    }

    init({
      dsn: cached.dsn,
      environment: cached.environment ?? undefined,
      release: `desktop@${app.getVersion()}`,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      integrations: (defaults) =>
        defaults.filter((each) => !LEFT_OUT.has(each.name)),
    });
  }

  async refresh(origin: string): Promise<void> {
    try {
      const response = await net.fetch(`${origin}/api/error-reporting`);
      const answer: unknown = await response.json();

      if (typeof answer !== 'object' || answer === null) {
        return;
      }

      const reporting = {
        dsn: 'dsn' in answer ? answer.dsn : undefined,
        environment:
          'environment' in answer && typeof answer.environment === 'string'
            ? answer.environment
            : null,
      };

      writeFileSync(
        this.path,
        JSON.stringify(isReporting(reporting) ? reporting : {}),
      );
    } catch {}
  }
}
