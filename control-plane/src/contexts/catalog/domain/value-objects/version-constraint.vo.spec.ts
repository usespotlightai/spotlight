import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import { VersionConstraint } from '@catalog/domain/value-objects/version-constraint.vo';
import { describe, expect, it } from 'vitest';

const matching = (constraint: string, versions: string[]) =>
  versions.filter((each) =>
    VersionConstraint.of(constraint).matches(CatalogVersion.of(each)),
  );

const VERSIONS = ['0.9.0', '1.0.0', '1.0.4', '1.1.0', '1.10.2', '2.0.0'];

describe('a version constraint, written as Terraform writes one', () => {
  it('takes a bare version to mean exactly that version', () => {
    expect(matching('1.0.4', VERSIONS)).toEqual(['1.0.4']);
    expect(matching('= 1.1', VERSIONS)).toEqual(['1.1.0']);
  });

  it('lets ~> with two parts move up to the next major', () => {
    expect(matching('~> 1.0', VERSIONS)).toEqual([
      '1.0.0',
      '1.0.4',
      '1.1.0',
      '1.10.2',
    ]);
  });

  it('lets ~> with three parts move only the patch', () => {
    expect(matching('~> 1.0.1', VERSIONS)).toEqual(['1.0.4']);
  });

  it('satisfies every clause at once', () => {
    expect(matching('>= 1.0.4, < 2.0, != 1.1.0', VERSIONS)).toEqual([
      '1.0.4',
      '1.10.2',
    ]);
  });

  it('is required', () => {
    expect(() => VersionConstraint.of('  ')).toThrow(/is required/);
  });

  it('rejects what is not a constraint, naming the part it could not read', () => {
    expect(() => VersionConstraint.of('>= 1.0, latest')).toThrow(/"latest"/);
    expect(() => VersionConstraint.of('^1.2')).toThrow(/"\^1.2"/);
  });
});
