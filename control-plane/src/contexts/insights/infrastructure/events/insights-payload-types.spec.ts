import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { INSIGHTS_PAYLOAD_TYPES } from '@insights/infrastructure/events/insights-payload-types';
import { JUDGE_REPAIR_PAYLOAD_TYPES } from '@insights/infrastructure/events/judge-repair-payload-types';
import { describe, expect, it } from 'vitest';

const FOLDERS = ['value-objects', 'events'];

describe('INSIGHTS_PAYLOAD_TYPES', () => {
  it('contains every class that can travel in an event', async () => {
    const listed = new Set<unknown>([
      ...INSIGHTS_PAYLOAD_TYPES,
      ...JUDGE_REPAIR_PAYLOAD_TYPES,
    ]);
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

        if (typeof loaded !== 'object' || loaded === null) {
          continue;
        }

        for (const name of Object.keys(loaded)) {
          const value: unknown = Reflect.get(loaded, name);

          if (
            typeof value === 'function' &&
            /^class\s/.test(value.toString()) &&
            !listed.has(value)
          ) {
            missing.push(`${folder}/${file}: ${name}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
