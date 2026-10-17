import type {
  ParsedTeam,
  ParsedWorkspace,
  ParsedWorkspaceToken,
} from '@identity/application/ports/identity-definitions.port';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const definitions = new IdentityDefinitions();

const invalidAt = (
  compiled: ParsedWorkspace | ParsedTeam | ParsedWorkspaceToken,
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
      invalidAt(definitions.workspace({ name: '', slug: 'Acme Inc' })),
    ).toEqual(['name', 'slug']);
  });

  it('rejects a slug that is not written the way it is kept', () => {
    expect(
      invalidAt(definitions.workspace({ name: 'Acme', slug: 'ACME' })),
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
      invalidAt(definitions.team({ key: 'Core Team', name: 'Core' })),
    ).toEqual(['key']);
  });

  it('reads a workspace token as its terms, never expiring and undescribed unless told', () => {
    const compiled = definitions.workspaceToken({
      name: 'ci',
      scopes: ['plan'],
    });

    expect(
      compiled.ok && [
        compiled.terms.name.value,
        compiled.terms.scopes.toString(),
        compiled.terms.description.value,
        compiled.terms.expiresAt,
      ],
    ).toEqual(['ci', 'plan', '', null]);
  });

  it('reads when a workspace token expires', () => {
    const compiled = definitions.workspaceToken({
      name: 'ci',
      scopes: ['configure'],
      expiresAt: '2026-12-31T23:59:59Z',
    });

    expect(compiled.ok && compiled.terms.expiresAt?.toISOString()).toBe(
      '2026-12-31T23:59:59.000Z',
    );
  });

  it('points at each workspace token field it cannot read', () => {
    expect(
      invalidAt(
        definitions.workspaceToken({
          name: 'CI token',
          scopes: ['plan', 'apply'],
          expiresAt: 'next week',
        }),
      ),
    ).toEqual(['name', 'scopes.1', 'expiresAt']);
  });

  it.each([
    [['secrets'], /need one of them/],
    [['runners'], /need one of them/],
    [['trusts'], /need one of them/],
    [['plan', 'plan'], /each scope once/],
    [[], /need one of them/],
  ])('rejects a token whose scopes are %j', (scopes, reason) => {
    const compiled = definitions.workspaceToken({ name: 'ci', scopes });

    expect(
      compiled.ok ? [] : compiled.problems.map((each) => each.reason),
    ).toEqual([expect.stringMatching(reason)]);
  });
});
