import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { CATALOG_PAYLOAD_TYPES } from '@catalog/infrastructure/events/catalog-payload-types';
import { describe, expect, it } from 'vitest';

const FOLDERS = ['value-objects', 'events'];

const isModule = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

describe('CATALOG_PAYLOAD_TYPES', () => {
  it('contains every class that can travel in an event', async () => {
    const registered = new Set<unknown>(CATALOG_PAYLOAD_TYPES);
    const missing: string[] = [];

    for (const folder of FOLDERS) {
      const within = join(__dirname, '..', '..', 'domain', folder);

      if (!existsSync(within)) {
        continue;
      }

      for (const file of readdirSync(within).filter(
        (each) => each.endsWith('.ts') && !each.endsWith('.spec.ts'),
      )) {
        const loaded: unknown = await import(join(within, file));

        if (!isModule(loaded)) {
          continue;
        }

        for (const [name, value] of Object.entries(loaded)) {
          if (
            typeof value === 'function' &&
            /^class\s/.test(value.toString()) &&
            !registered.has(value)
          ) {
            missing.push(`${folder}/${file}: ${name}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
