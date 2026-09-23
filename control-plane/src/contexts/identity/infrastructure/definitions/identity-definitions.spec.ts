import type {
  CompiledTeam,
  CompiledWorkspace,
} from '@identity/application/ports/identity-definitions.port';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const definitions = new IdentityDefinitions();

const refusedAt = (
  compiled: CompiledWorkspace | CompiledTeam,
): (string | undefined)[] =>
  compiled.ok ? [] : compiled.problems.map((each) => dottedOf(each.field));

describe('IdentityDefinitions', () => {
  it('reads a workspace as its name and slug', () => {
    const compiled = definitions.workspace({ name: 'Acme', slug: 'acme' });

    expect(compiled.ok && [compiled.name.value, compiled.slug.value]).toEqual([
      'Acme',
      'acme',
    ]);
  });

  it('points at each workspace field it cannot read', () => {
    expect(
      refusedAt(definitions.workspace({ name: '', slug: 'Acme Inc' })),
    ).toEqual(['name', 'slug']);
  });

  it('refuses a slug that is not written the way it is kept', () => {
    expect(
      refusedAt(definitions.workspace({ name: 'Acme', slug: 'ACME' })),
    ).toEqual(['slug']);
  });

  it('reads a team as its key and name', () => {
    const compiled = definitions.team({ key: 'core', name: 'Core' });

    expect(compiled.ok && [compiled.key.value, compiled.name.value]).toEqual([
      'core',
      'Core',
    ]);
  });

  it('points at the team key when it is not lowercase words', () => {
    expect(
      refusedAt(definitions.team({ key: 'Core Team', name: 'Core' })),
    ).toEqual(['key']);
  });
});
