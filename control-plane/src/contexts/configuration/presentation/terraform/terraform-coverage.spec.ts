import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  HELD_KINDS,
  type HeldKind,
} from '@configuration/application/dto/held-configuration.dto';
import { RESOURCE_EXTENSION } from '@platform/http/resources/resource-headers';
import { describe, expect, it } from 'vitest';

const NOT_EXPORTED: Readonly<Record<string, string>> = {
  'workspace-token':
    'only a person who administers the workspace may issue, change or revoke a token, and Terraform calls with a token, which never administers',
};

const kindsInOpenApi = (): readonly string[] => {
  const document = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../../openapi.json'), 'utf8'),
  ) as { paths: Record<string, Record<string, Record<string, unknown>>> };

  return [
    ...new Set(
      Object.values(document.paths).flatMap((operations) =>
        Object.values(operations).flatMap((operation) => {
          const extension = operation[RESOURCE_EXTENSION] as
            | { kind?: string }
            | undefined;

          return extension?.kind ? [extension.kind] : [];
        }),
      ),
    ),
  ].sort();
};

describe('the kinds a workspace export covers', () => {
  it('exports every resource kind the API serves, or names why not', () => {
    const exported = new Set<string>(HELD_KINDS);
    const forgotten = kindsInOpenApi().filter(
      (kind) => !exported.has(kind) && !(kind in NOT_EXPORTED),
    );

    expect(forgotten).toEqual([]);
  });

  it('does not both export a kind and say why it does not', () => {
    expect(HELD_KINDS.filter((kind: HeldKind) => kind in NOT_EXPORTED)).toEqual(
      [],
    );
  });

  it('exports nothing the API does not serve', () => {
    expect(
      HELD_KINDS.filter((kind) => !kindsInOpenApi().includes(kind)),
    ).toEqual([]);
  });
});
