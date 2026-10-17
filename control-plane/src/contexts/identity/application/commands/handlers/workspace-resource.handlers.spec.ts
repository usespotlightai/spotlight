import { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import { CreateWorkspaceHandler } from '@identity/application/commands/handlers/create-workspace.handler';
import { DeleteWorkspaceHandler } from '@identity/application/commands/handlers/delete-workspace.handler';
import { UpdateWorkspaceHandler } from '@identity/application/commands/handlers/update-workspace.handler';
import { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import { DependentsRegistry } from '@identity/application/services/dependents-registry.service';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
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
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { TokenPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { describe, expect, it } from 'vitest';

const ACME = { name: 'Acme', slug: 'acme' };

const CONFIGURE_TOKEN = Actor.of(
  TokenPrincipal.of({
    tokenId: WorkspaceTokenId.of('token_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    scopes: TokenScopes.named(['configure']),
    issuedBy: OWNER,
  }),
  Client.named('terraform-provider/0.1.0'),
);

describe('CreateWorkspaceHandler', () => {
  const creating = (over: { taken?: boolean; by?: Actor } = {}) => {
    const stored = workspaces({ taken: over.taken });
    const keys = creates();
    const handler = new CreateWorkspaceHandler(
      new IdentityDefinitions(),
      stored,
      keys,
      { generate: () => 'ws_new' },
      transaction,
    );

    return {
      create: (definition: unknown) =>
        handler.execute(
          new CreateWorkspaceCommand(
            over.by ?? actorFor(OWNER.value),
            'key-1',
            definition,
          ),
        ),
      stored,
      keys,
    };
  };

  it('creates a workspace owned by the caller, with no first team', async () => {
    const { create, stored, keys } = creating();

    expect(await create(ACME)).toEqual({
      outcome: 'created',
      id: 'ws_new',
      replayed: false,
    });

    const [added] = stored.add.mock.calls[0] as [Workspace];

    expect(added.roleOf(OWNER)?.isOwner).toBe(true);
    expect(keys.created).toHaveBeenCalledWith(expect.anything(), 'ws_new');
  });

  it('forbids a token to create a workspace, since it acts only inside its own', async () => {
    const { create, stored } = creating({ by: CONFIGURE_TOKEN });

    expect(await create(ACME)).toEqual(forbiddenTo('create-workspaces'));
    expect(stored.add).not.toHaveBeenCalled();
  });

  it('says a slug that another workspace uses is taken', async () => {
    expect(await creating({ taken: true }).create(ACME)).toEqual({
      outcome: 'taken',
      address: 'acme',
    });
  });

  it('says what is wrong, and creates nothing', async () => {
    const { create, stored } = creating();
    const rejected = await create({ name: 'Acme' });

    expect(
      rejected?.outcome === 'invalid' &&
        rejected.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['slug']);
    expect(stored.add).not.toHaveBeenCalled();
  });
});

describe('UpdateWorkspaceHandler', () => {
  const updating = (over: Parameters<typeof workspaces>[0] = {}) => {
    const stored = workspaces({ existing: workspaceAt(3), ...over });
    const handler = new UpdateWorkspaceHandler(
      new IdentityDefinitions(),
      stored,
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
      stored,
    };
  };

  it('renames the version in the request', async () => {
    const { update, stored } = updating();

    expect(await update({ name: 'Acme Inc', slug: 'acme' })).toEqual({
      outcome: 'updated',
      id: 'ws_1',
    });

    const [saved] = stored.save.mock.calls[0] as [Workspace];

    expect(saved.name.value).toBe('Acme Inc');
  });

  it('points at the slug when a request moves it', async () => {
    const rejected = await updating().update({
      name: 'Acme',
      slug: 'elsewhere',
    });

    expect(
      rejected?.outcome === 'invalid' &&
        rejected.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['slug']);
  });

  it('names the current version to a change made against another', async () => {
    expect(await updating().update(ACME, { version: 2 })).toEqual({
      outcome: 'version-conflict',
      currentVersion: 3,
    });
    expect(
      await updating({
        throwing: new WorkspaceVersionConflictError('acme'),
        thenAt: workspaceAt(4),
      }).update(ACME),
    ).toEqual({ outcome: 'version-conflict', currentVersion: 4 });
  });

  it('forbids a member who does not administer it, and answers no one else', async () => {
    expect(await updating().update(ACME, { by: MEMBER })).toEqual(
      forbiddenTo('configure'),
    );
    expect(await updating({ existing: null }).update(ACME)).toBeNull();
  });
});

describe('DeleteWorkspaceHandler', () => {
  const deleting = (
    over: {
      hasTeam?: boolean;
      issued?: boolean;
      trusted?: boolean;
      issuing?: boolean;
      dependents?: readonly string[];
    } = {},
  ) => {
    const stored = workspaces({ existing: workspaceAt(3) });
    const registry = new DependentsRegistry<WorkspaceId>();
    registry.register({ dependentsOf: async () => over.dependents ?? [] });
    const handler = new DeleteWorkspaceHandler(
      stored,
      teamKeys(
        over.hasTeam ? ['core'] : [],
        over.issued ? ['ci'] : [],
        over.trusted ? ['github-main'] : [],
        over.issuing ? ['github-main'] : [],
      ),
      registry,
      transaction,
    );

    return {
      remove: (by: Actor = actorFor(OWNER.value)) =>
        handler.execute(new DeleteWorkspaceCommand('ws_1', by, 3)),
      stored,
    };
  };

  it('deletes a workspace that has no team', async () => {
    const { remove, stored } = deleting();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect((stored.save.mock.calls[0] as [Workspace])[0].isDeleted).toBe(true);
  });

  it('will not delete a workspace that still has a team', async () => {
    const { remove, stored } = deleting({ hasTeam: true });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('core'),
    });
    expect(stored.save).not.toHaveBeenCalled();
  });

  it('will not delete a workspace that still has a token', async () => {
    const { remove, stored } = deleting({ issued: true });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('token ci'),
    });
    expect(stored.save).not.toHaveBeenCalled();
  });

  it('will not delete a workspace that still has a token trust', async () => {
    const { remove, stored } = deleting({ trusted: true });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('token trust github-main'),
    });
    expect(stored.save).not.toHaveBeenCalled();
  });

  it('will not delete a workspace that still has tokens issued by a trust deleted a moment ago', async () => {
    const { remove, stored } = deleting({ issuing: true });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('tokens issued by github-main'),
    });
    expect(stored.save).not.toHaveBeenCalled();
  });

  it('will not delete a workspace in which another context still has something', async () => {
    const { remove, stored } = deleting({
      dependents: ['secret LINEAR_API_KEY'],
    });

    expect(await remove()).toMatchObject({
      outcome: 'in-use',
      reason: expect.stringContaining('secret LINEAR_API_KEY'),
    });
    expect(stored.save).not.toHaveBeenCalled();
  });

  it('forbids a member who does not administer it', async () => {
    expect(await deleting().remove(actorFor(MEMBER.value))).toEqual(
      forbiddenTo('administer'),
    );
  });

  it('forbids a token that configures it, since deleting is administration', async () => {
    const { remove, stored } = deleting();

    expect(await remove(CONFIGURE_TOKEN)).toEqual(forbiddenTo('administer'));
    expect(stored.save).not.toHaveBeenCalled();
  });
});
