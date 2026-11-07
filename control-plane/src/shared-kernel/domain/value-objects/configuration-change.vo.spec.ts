import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { describe, expect, it } from 'vitest';

describe('ConfigurationChange', () => {
  it('records the resource type its publisher names', () => {
    expect(
      ConfigurationChange.created(
        { resource: 'runner-pool', id: 'pool_1', key: 'build' },
        changeActorIn(),
      ).resource,
    ).toBe('runner-pool');
  });

  it.each(['', 'Runner Pool', 'runner_pool', '-pool'])(
    'refuses %j as a resource type',
    (resource) => {
      expect(() =>
        ConfigurationChange.deleted(
          { resource, id: 'pool_1', key: 'build' },
          changeActorIn(),
        ),
      ).toThrow(InvalidIdentifierError);
    },
  );
});
