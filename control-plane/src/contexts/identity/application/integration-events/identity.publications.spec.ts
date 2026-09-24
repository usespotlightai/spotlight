import { IDENTITY_PUBLICATIONS } from '@identity/application/integration-events/identity.publications';
import { TeamCreated } from '@identity/domain/events/team-created.event';
import { TeamDisbanded } from '@identity/domain/events/team-disbanded.event';
import { WorkspaceClosed } from '@identity/domain/events/workspace-closed.event';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { changed } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  IDENTITY_PUBLICATIONS.filter((each) => each.from === event.kind).map((each) =>
    each.publish(event),
  );

const WORKSPACE = WorkspaceId.of('ws_1');

const TEAM = [
  WORKSPACE,
  TeamId.of('team_1'),
  TeamKey.of('core'),
  changed('team', 'team_1', 'core'),
] as const;

describe('IDENTITY_PUBLICATIONS', () => {
  it('publishes a disbanded team as plain data', () => {
    expect(published(new TeamDisbanded(...TEAM))).toEqual([
      {
        kind: 'identity.team-disbanded.v1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        key: 'core',
      },
    ]);
  });

  it('publishes a new team with how it came to be', () => {
    expect(
      published(
        new TeamCreated(
          WORKSPACE,
          TeamId.of('team_1'),
          UserId.of('user_1'),
          'configuration',
          changed('team', 'team_1', 'core'),
        ),
      ),
    ).toEqual([
      {
        kind: 'identity.team-created.v1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        ownerId: 'user_1',
        origin: 'configuration',
      },
    ]);
  });

  it('publishes a workspace’s closing', () => {
    expect(
      published(
        new WorkspaceClosed(
          WORKSPACE,
          WorkspaceSlug.of('acme'),
          changed('workspace', 'ws_1', 'acme'),
        ),
      ),
    ).toEqual([
      {
        kind: 'identity.workspace-closed.v1',
        workspaceId: 'ws_1',
        slug: 'acme',
      },
    ]);
  });
});
