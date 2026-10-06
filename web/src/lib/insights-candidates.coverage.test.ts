import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOST_CHANGES_ASKED } from '@/lib/insights-candidates';

type Schema = {
  readonly properties: Readonly<
    Record<string, { readonly description?: string }>
  >;
};

const schemas = (
  JSON.parse(
    readFileSync(
      resolve(__dirname, '../../../control-plane/openapi.json'),
      'utf8',
    ),
  ) as { components: { schemas: Readonly<Record<string, Schema>> } }
).components.schemas;

describe('MOST_CHANGES_ASKED', () => {
  it('asks no more changes at once than the server takes', () => {
    const said =
      schemas.ReadConfigOriginsRequestDto?.properties.changes?.description ??
      '';

    expect(Number(/at most (\d+)/i.exec(said)?.[1])).toBe(MOST_CHANGES_ASKED);
  });
});
