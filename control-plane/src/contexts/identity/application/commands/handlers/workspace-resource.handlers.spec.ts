import { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import { CreateWorkspaceHandler } from '@identity/application/commands/handlers/create-workspace.handler';
import { DeleteWorkspaceHandler } from '@identity/application/commands/handlers/delete-workspace.handler';
import { UpdateWorkspaceHandler } from '@identity/application/commands/handlers/update-workspace.handler';
import { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import { HoldingsRegistry } from '@identity/application/services/holdings-registry.service';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceMovedOnError } from '@identity/domain/exceptions/workspace-moved-on.error';
import {
  creates,
  MEMBER,
  OWNER,
  teamKeys,
  transaction,
  workspaceAt,
  workspaces,
} from '@identity/identity.resources.fake-spec';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { FORBIDDEN } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const ACME = { name: 'Acme', slug: 'acme' };

describe('CreateWorkspaceHandler', () => {
  const creating = (over: { taken?: boolean } = {}) => {
    const kept = workspaces({ taken: over.taken });
    const keys = creates();
    const handler = new CreateWorkspaceHandler(
      new IdentityDefinitions(),
      kept,
      keys,
      { generate: () => 'ws_new' },
      transaction,
    );

    return {
      create: (definition: unknown) =>
        handler.execute(
          new CreateWorkspaceCommand(
            actorFor(OWNER.value),
            'key-1',
            definition,
          ),
        ),
      kept,
      keys,
    };
  };

  it('opens a workspace owned by whoever asked, with no first team', async () => {
    const { create, kept, keys } = creating();

    expect(await create(ACME)).toEqual({
      outcome: 'created',
      id: 'ws_new',
      replayed: false,
    });

    const [added] = kept.add.mock.calls[0] as [Workspace];

    expect(added.roleOf(OWNER)?.isOwner).toBe(true);
    expect(keys.created).toHaveBeenCalledWith(expect.anything(), 'ws_new');
  });

  it('says a slug somebody holds is taken', async () => {
    expect(await creating({ taken: true }).create(ACME)).toEqual({
      outcome: 'taken',
      address: 'acme',
    });
  });

  it('says what is wrong, and opens nothing', async () => {
    const { create, kept } = creating();
    const refused = await create({ name: 'Acme' });

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['slug']);
    expect(kept.add).not.toHaveBeenCalled();
  });
});

describe('UpdateWorkspaceHandler', () => {
  const updating = (over: Parameters<typeof workspaces>[0] = {}) => {
    const kept = workspaces({ standing: workspaceAt(3), ...over });
    const handler = new UpdateWorkspaceHandler(
      new IdentityDefinitions(),
      kept,
      transaction,
    );

    return {
      update: (definition: unknown, { by = OWNER, version = 3 } = {}) =>
        handler.execute(
          new UpdateWorkspaceCommand(
            'ws_1',
            actorFor(by.value),
            version,
            definition,
          ),
        ),
      kept,
    };
  };

  it('renames the version it was asked to', async () => {
    const { update, kept } = updating();

    expect(await update({ name: 'Acme Inc', slug: 'acme' })).toEqual({
      outcome: 'updated',
      id: 'ws_1',
    });

    const [saved] = kept.save.mock.calls[0] as [Workspace];

    expect(saved.name.value).toBe('Acme Inc');
  });

  it('points at the slug when asked to move it', async () => {
    const refused = await updating().update({
      name: 'Acme',
      slug: 'elsewhere',
    });

    expect(
      refused?.outcome === 'invalid' &&
        refused.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['slug']);
  });

  it('names the current version to a change made against another', async () => {
    expect(await updating().update(ACME, { version: 2 })).toEqual({
      outcome: 'moved-on',
      currentVersion: 3,
    });
    expect(
      await updating({
        refusing: new WorkspaceMovedOnError('acme'),
        thenAt: workspaceAt(4),
      }).update(ACME),
    ).toEqual({ outcome: 'moved-on', currentVersion: 4 });
  });

  it('forbids a member who does not administer it, and answers no one else', async () => {
    expect(await updating().update(ACME, { by: MEMBER })).toEqual(FORBIDDEN);
    expect(await updating({ standing: null }).update(ACME)).toBeNull();
  });
});

describe('DeleteWorkspaceHandler', () => {
  const deleting = (
    over: {
      held?: boolean;
      issued?: boolean;
      holding?: readonly string[];
    } = {},
  ) => {
    const kept = workspaces({ standing: workspaceAt(3) });
    const holdings = new HoldingsRegistry<WorkspaceId>();
    holdings.register({ heldBy: async () => over.holding ?? [] });
    const handler = new DeleteWorkspaceHandler(
      kept,
      teamKeys(over.held ? ['core'] : [], over.issued ? ['ci'] : []),
      holdings,
      transaction,
    );

    return {
      remove: (by = OWNER) =>
        handler.execute(
          new DeleteWorkspaceCommand('ws_1', actorFor(by.value), 3),
        ),
      kept,
    };
  };

  it('closes a workspace that holds no team', async () => {
    const { remove, kept } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect((kept.save.mock.calls[0] as [Workspace])[0].isClosed).toBe(true);
  });

  it('will not close a workspace that still holds a team', async () => {
    const { remove, kept } = deleting({ held: true });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('core'),
    });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('will not close a workspace that still holds a token', async () => {
    const { remove, kept } = deleting({ issued: true });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('token ci'),
    });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('will not close a workspace another context still holds something in', async () => {
    const { remove, kept } = deleting({ holding: ['secret LINEAR_API_KEY'] });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('secret LINEAR_API_KEY'),
    });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('forbids a member who does not administer it', async () => {
    expect(await deleting().remove(MEMBER)).toEqual(FORBIDDEN);
  });
});
