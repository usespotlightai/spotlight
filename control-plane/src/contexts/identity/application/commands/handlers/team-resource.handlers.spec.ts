import { CreateTeamCommand } from '@identity/application/commands/create-team.command';
import { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import { CreateTeamHandler } from '@identity/application/commands/handlers/create-team.handler';
import { DeleteTeamHandler } from '@identity/application/commands/handlers/delete-team.handler';
import { UpdateTeamHandler } from '@identity/application/commands/handlers/update-team.handler';
import { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import { TeamAlreadyExistsError } from '@identity/domain/exceptions/team-already-exists.error';
import {
  access,
  creates,
  dependents,
  OWNER,
  teamAt,
  teams,
  transaction,
} from '@identity/identity.resources.fake-spec';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const CORE = { key: 'core', name: 'Core' };

describe('CreateTeamHandler', () => {
  const creating = (over: { administers?: boolean; throwing?: Error } = {}) => {
    const stored = teams({ throwing: over.throwing });
    const handler = new CreateTeamHandler(
      access(over.administers),
      new IdentityDefinitions(),
      stored,
      creates(),
      { generate: () => 'team_new' },
      transaction,
    );

    return {
      create: (definition: unknown) =>
        handler.execute(
          new CreateTeamCommand(
            'ws_1',
            actorFor(OWNER.value),
            'key-1',
            definition,
          ),
        ),
      stored,
    };
  };

  it('creates a bare team keyed as requested', async () => {
    const { create, stored } = creating();

    expect(await create(CORE)).toMatchObject({
      outcome: 'created',
      id: 'team_new',
    });

    const [added] = stored.add.mock.calls[0] as [Team];

    expect(added.key.value).toBe('core');
    expect(added.pullEvents()).toEqual([
      expect.objectContaining({ origin: 'configuration' }),
    ]);
  });

  it('says a key the workspace already has is taken', async () => {
    expect(
      await creating({ throwing: new TeamAlreadyExistsError('core') }).create(
        CORE,
      ),
    ).toEqual({ outcome: 'taken', address: 'core' });
  });

  it('forbids a member who does not administer the workspace', async () => {
    expect(await creating({ administers: false }).create(CORE)).toEqual(
      forbiddenTo('configure'),
    );
  });
});

describe('UpdateTeamHandler', () => {
  const updating = (administers = true) => {
    const stored = teams({ existing: teamAt(3) });
    const handler = new UpdateTeamHandler(
      access(administers),
      new IdentityDefinitions(),
      stored,
      transaction,
    );

    return {
      update: (definition: unknown, version = 3) =>
        handler.execute(
          new UpdateTeamCommand(
            'team_1',
            actorFor(OWNER.value),
            version,
            definition,
          ),
        ),
      stored,
    };
  };

  it('renames the team', async () => {
    const { update, stored } = updating();

    expect(await update({ key: 'core', name: 'Core platform' })).toEqual({
      outcome: 'updated',
      id: 'team_1',
    });
    expect((stored.save.mock.calls[0] as [Team])[0].name.value).toBe(
      'Core platform',
    );
  });

  it('points at the key when a request changes it', async () => {
    const rejected = await updating().update({ key: 'platform', name: 'Core' });

    expect(
      rejected?.outcome === 'invalid' &&
        rejected.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['key']);
  });

  it('names the current version to a change made against another', async () => {
    expect(await updating().update(CORE, 2)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 3,
    });
  });

  it('forbids a member who does not administer the workspace', async () => {
    expect(await updating(false).update(CORE)).toEqual(
      forbiddenTo('configure'),
    );
  });
});

describe('DeleteTeamHandler', () => {
  const deleting = (names: readonly string[] = []) => {
    const stored = teams({ existing: teamAt(3) });
    const handler = new DeleteTeamHandler(
      access(),
      stored,
      dependents(names),
      transaction,
    );

    return {
      remove: () =>
        handler.execute(
          new DeleteTeamCommand('team_1', actorFor(OWNER.value), 3),
        ),
      stored,
    };
  };

  it('deletes a team that has nothing', async () => {
    const { remove, stored } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect((stored.save.mock.calls[0] as [Team])[0].isDeleted).toBe(true);
  });

  it('will not delete a team that still has configuration, and says what', async () => {
    const { remove, stored } = deleting([
      'line delivery',
      'integration linear',
    ]);

    expect(await remove()).toEqual({
      outcome: 'in-use',
      reason: expect.stringContaining('integration linear, line delivery'),
    });
    expect(stored.save).not.toHaveBeenCalled();
  });
});
