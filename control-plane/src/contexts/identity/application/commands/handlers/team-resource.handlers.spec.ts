import { CreateTeamCommand } from '@identity/application/commands/create-team.command';
import { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import { CreateTeamHandler } from '@identity/application/commands/handlers/create-team.handler';
import { DeleteTeamHandler } from '@identity/application/commands/handlers/delete-team.handler';
import { UpdateTeamHandler } from '@identity/application/commands/handlers/update-team.handler';
import { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import { TeamAlreadyDefinedError } from '@identity/domain/exceptions/team-already-defined.error';
import {
  access,
  creates,
  holdings,
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
  const creating = (over: { administers?: boolean; refusing?: Error } = {}) => {
    const kept = teams({ refusing: over.refusing });
    const handler = new CreateTeamHandler(
      access(over.administers),
      new IdentityDefinitions(),
      kept,
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
      kept,
    };
  };

  it('defines a bare team keyed as asked', async () => {
    const { create, kept } = creating();

    expect(await create(CORE)).toMatchObject({
      outcome: 'created',
      id: 'team_new',
    });

    const [added] = kept.add.mock.calls[0] as [Team];

    expect(added.key.value).toBe('core');
    expect(added.pullEvents()).toEqual([
      expect.objectContaining({ origin: 'configuration' }),
    ]);
  });

  it('says a key the workspace already has is taken', async () => {
    expect(
      await creating({ refusing: new TeamAlreadyDefinedError('core') }).create(
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
    const kept = teams({ standing: teamAt(3) });
    const handler = new UpdateTeamHandler(
      access(administers),
      new IdentityDefinitions(),
      kept,
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
      kept,
    };
  };

  it('renames the team', async () => {
    const { update, kept } = updating();

    expect(await update({ key: 'core', name: 'Core platform' })).toEqual({
      outcome: 'updated',
      id: 'team_1',
    });
    expect((kept.save.mock.calls[0] as [Team])[0].name.value).toBe(
      'Core platform',
    );
  });

  it('points at the key when asked to change it', async () => {
    const refused = await updating().update({ key: 'platform', name: 'Core' });

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['key']);
  });

  it('names the current version to a change made against another', async () => {
    expect(await updating().update(CORE, 2)).toEqual({
      outcome: 'moved-on',
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
  const deleting = (held: readonly string[] = []) => {
    const kept = teams({ standing: teamAt(3) });
    const handler = new DeleteTeamHandler(
      access(),
      kept,
      holdings(held),
      transaction,
    );

    return {
      remove: () =>
        handler.execute(
          new DeleteTeamCommand('team_1', actorFor(OWNER.value), 3),
        ),
      kept,
    };
  };

  it('disbands a team that holds nothing', async () => {
    const { remove, kept } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect((kept.save.mock.calls[0] as [Team])[0].isDisbanded).toBe(true);
  });

  it('will not disband a team that still holds configuration, and says what', async () => {
    const { remove, kept } = deleting(['line delivery', 'integration linear']);

    expect(await remove()).toEqual({
      outcome: 'in-use',
      reason: expect.stringContaining('integration linear, line delivery'),
    });
    expect(kept.save).not.toHaveBeenCalled();
  });
});
