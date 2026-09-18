import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIGURATION_EVENT_TYPES } from '@configuration/domain/event-types';
import { SECRET } from '@shared-kernel/domain/value-objects/secret';
import { describe, expect, it } from 'vitest';

const FOLDERS = ['value-objects', 'events'];

describe('CONFIGURATION_EVENT_TYPES', () => {
  it('holds every class that can travel in an event', async () => {
    const held = new Set<unknown>(CONFIGURATION_EVENT_TYPES);
    const missing: string[] = [];

    for (const folder of FOLDERS) {
      const within = join(__dirname, 'domain', folder);

      if (!existsSync(within)) {
        continue;
      }

      for (const file of readdirSync(within).filter(
        (each) => each.endsWith('.ts') && !each.endsWith('.spec.ts'),
      )) {
        const loaded: Record<string, unknown> = await import(
          join(within, file)
        );

        for (const [name, value] of Object.entries(loaded)) {
          if (
            typeof value === 'function' &&
            /^class\s/.test(value.toString()) &&
            !(SECRET in value.prototype) &&
            !held.has(value)
          ) {
            missing.push(`${folder}/${file}: ${name}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('holds no secret, which must never travel in an event', () => {
    expect(
      CONFIGURATION_EVENT_TYPES.filter((type) => SECRET in type.prototype).map(
        (type) => type.name,
      ),
    ).toEqual([]);
  });
});
