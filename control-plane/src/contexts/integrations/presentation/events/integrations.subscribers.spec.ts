import type { RefreshIntegrationSpecHandler } from '@integrations/application/commands/handlers/refresh-integration-spec.handler';
import type { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import type { InboundDeliveryRetention } from '@integrations/application/services/inbound-delivery-retention.service';
import type { InferOutputSchemas } from '@integrations/application/services/infer-output-schemas.service';
import type { IntegrationCursors } from '@integrations/application/services/integration-cursors.service';
import type { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import type { MemberConnections } from '@integrations/application/services/member-connections.service';
import type { PullRequestConflictReactions } from '@integrations/application/services/pull-request-conflict-reactions.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { OAuth2ClientId } from '@integrations/domain/value-objects/oauth2-client-id.vo';
import { integrationsSubscribers } from '@integrations/presentation/events/integrations.subscribers';
import {
  PULL_REQUEST_CONFLICTED,
  type PullRequestConflictedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-conflicted.integration-event';
import {
  WORKSPACE_MEMBER_ACCESS_ENDED,
  type WorkspaceMemberAccessEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-member-access-ended.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ConnectionAsksPort } from '@work/application/ports/connection-asks.port';
import { describe, expect, it, vi } from 'vitest';

const connected = (owner: ConnectionOwner) =>
  IntegrationConnection.connectFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    integration: IntegrationKey.of('linear'),
    owner,
    client: OAuth2ClientId.of('client_1'),
    tokens: OAuthTokens.of({ accessToken: 'lin-1' }),
    at: new Date('2026-09-01T00:00:00.000Z'),
  }).pullEvents()[0];

const subscribersWith = (
  execute: RefreshIntegrationSpecHandler['execute'],
  answer: ConnectionAsksPort['answer'],
) =>
  integrationsSubscribers(
    {} as DeleteTeamIntegrations,
    {} as LifecycleHookTriggers,
    { execute } as unknown as RefreshIntegrationSpecHandler,
    {} as InferOutputSchemas,
    { answer },
    {} as IntegrationCursors,
    {} as InboundDeliveryRetention,
    {} as MemberConnections,
    {} as PullRequestConflictReactions,
  );

const handledBy = async (
  name: string,
  owner: ConnectionOwner,
  execute: RefreshIntegrationSpecHandler['execute'],
  answer: ConnectionAsksPort['answer'],
) => {
  const subscriber = subscribersWith(execute, answer).find(
    (each) => each.name === name,
  );
  const event = connected(owner);

  if (subscriber && event) {
    await subscriber.handle(event, anOutboxRecord());
  }
};

const refreshSpecOn = async (owner: ConnectionOwner) => {
  const execute = vi.fn(async () => undefined);

  await handledBy(
    'integrations.refresh-spec-when-an-integration-connected',
    owner,
    execute,
    vi.fn(),
  );

  return execute;
};

const asksAnsweredOn = async (owner: ConnectionOwner) => {
  const answer = vi.fn(async () => undefined);

  await handledBy(
    'integrations.answer-asks-to-connect',
    owner,
    vi.fn(),
    answer,
  );

  return answer;
};

describe('integrationsSubscribers', () => {
  it('refreshes the spec of an integration once the team connects it', async () => {
    expect(await refreshSpecOn(ConnectionOwner.team())).toHaveBeenCalledOnce();
  });

  it('leaves the spec alone when a person connects their own account', async () => {
    expect(
      await refreshSpecOn(ConnectionOwner.person(UserId.of('user_1'))),
    ).not.toHaveBeenCalled();
  });

  it('answers the asks to connect when a person connects their own account', async () => {
    expect(
      await asksAnsweredOn(ConnectionOwner.person(UserId.of('user_1'))),
    ).toHaveBeenCalledWith({
      teamId: TeamId.of('team_1'),
      integration: 'linear',
      personId: UserId.of('user_1'),
    });
  });

  it('answers no ask when the team connects', async () => {
    expect(await asksAnsweredOn(ConnectionOwner.team())).not.toHaveBeenCalled();
  });

  it('disconnects a member once their access ends', async () => {
    const disconnect = vi.fn(async () => {});
    const subscriber = integrationsSubscribers(
      {} as DeleteTeamIntegrations,
      {} as LifecycleHookTriggers,
      {} as RefreshIntegrationSpecHandler,
      {} as InferOutputSchemas,
      { answer: vi.fn() },
      {} as IntegrationCursors,
      {} as InboundDeliveryRetention,
      { disconnect } as unknown as MemberConnections,
      {} as PullRequestConflictReactions,
    ).find((each) => each.kinds.includes(WORKSPACE_MEMBER_ACCESS_ENDED));

    const ended: WorkspaceMemberAccessEndedIntegrationEvent = {
      kind: WORKSPACE_MEMBER_ACCESS_ENDED,
      workspaceId: 'ws_1',
      userId: 'user_1',
    };

    await subscriber?.handle(ended, anOutboxRecord());

    expect(disconnect).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      UserId.of('user_1'),
    );
  });

  it('reacts to a pull request that conflicts once for each event', async () => {
    const conflicted = vi.fn(async () => {});
    const subscriber = integrationsSubscribers(
      {} as DeleteTeamIntegrations,
      {} as LifecycleHookTriggers,
      {} as RefreshIntegrationSpecHandler,
      {} as InferOutputSchemas,
      { answer: vi.fn() },
      {} as IntegrationCursors,
      {} as InboundDeliveryRetention,
      {} as MemberConnections,
      { conflicted } as unknown as PullRequestConflictReactions,
    ).find((each) => each.kinds.includes(PULL_REQUEST_CONFLICTED));

    const event: PullRequestConflictedIntegrationEvent = {
      kind: PULL_REQUEST_CONFLICTED,
      workspaceId: 'ws_1',
      pullRequest: 'https://github.com/acme/api/pull/18',
      repository: 'acme/api',
      branch: 'spotlight/fix-the-queue',
      base: 'main',
    };

    await subscriber?.handle(event, anOutboxRecord('evt_1'));

    expect(conflicted).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      {
        pullRequest: 'https://github.com/acme/api/pull/18',
        branch: 'spotlight/fix-the-queue',
        base: 'main',
      },
      'github-conflict:evt_1',
    );
  });
});
