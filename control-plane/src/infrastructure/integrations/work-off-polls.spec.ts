import type { ClockPort } from '@application/ports/clock.port';
import type { HappeningReactionsPort } from '@application/ports/happening-reactions.port';
import type {
  IntegrationCursorsPort,
  PollState,
} from '@application/ports/integration-cursors.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { Happened } from '@application/ports/webhook-source.port';
import { Factory } from '@domain/aggregates/factory.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import { WorkOffPolls } from '@infrastructure/integrations/work-off-polls';
import type {
  HttpOutbound,
  OutboundResult,
} from '@infrastructure/outbound/http-outbound';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');
const TEAM = TeamId.of('team_1');

const POLL = `
version: 1
integration: linear
poll:
  every: 60s
  request:
    method: GET
    url: https://api.linear.app/issues
    headers:
      authorization: '\${{ "Bearer " + secret.LINEAR_TOKEN }}'
  cursor: '\${{ body.lastId }}'
  events:
    - forEach: '\${{ body.issues }}'
      when: '\${{ item.done }}'
      raise:
        happening: linear.issue.completed
        label: Done
        told: Done.
        marks:
          - kind: linear.issue
            value: '\${{ item.id }}'
`;

const config = () =>
  TeamConfiguration.read({
    teamId: TEAM,
    repository: Repository.of('acme/api'),
    commit: Commit.of('abc1234'),
    files: [ConfigurationFile.of('.spotlight/integrations/linear.yml', POLL)],
    problems: [],
    readAt: NOW,
  });

const REPLY: OutboundResult = {
  ok: true,
  status: 200,
  response: {
    issues: [
      { id: 'ENG-1', done: true },
      { id: 'ENG-2', done: false },
    ],
    lastId: 'ENG-2',
  },
  capture: {},
};

const working = (state: PollState = { cursor: null, ranAt: null }) => {
  const run = vi.fn(
    async (_request: unknown, _against: { cursor: string }) => REPLY,
  );
  const react = vi.fn(
    async (_workspaceId: unknown, _teamId: string, _happenings: Happened[]) =>
      undefined,
  );
  const saved = vi.fn(async () => undefined);

  const polls = new WorkOffPolls(
    { all: async () => [config()] } as unknown as TeamConfigurationRepository,
    new IntegrationReader(),
    {
      ofTeam: async () =>
        Factory.of({
          id: FactoryId.of('factory_1'),
          workspaceId: WorkspaceId.of('ws_1'),
          teamId: TEAM,
        }),
    } as unknown as FactoryRepository,
    {
      resolve: async (_team: unknown, name: { value: string }) =>
        name.value === 'LINEAR_TOKEN' ? 'lin_1' : null,
    } as unknown as TeamSecretsPort,
    {
      read: async () => state,
      saved,
    } as unknown as IntegrationCursorsPort,
    { run } as unknown as HttpOutbound,
    { token: async () => null } as unknown as OAuth2Access,
    { react } as unknown as HappeningReactionsPort,
    { now: () => NOW } as ClockPort,
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { polls, run, react, saved };
};

describe('WorkOffPolls', () => {
  it('polls the host with the cursor it last kept', async () => {
    const { polls, run } = working({ cursor: 'ENG-0', ranAt: null });

    await polls.workOff();

    const against = run.mock.calls[0]?.[1];
    expect(against?.cursor).toBe('ENG-0');
  });

  it('raises one word per matching item in the response', async () => {
    const { polls, react } = working();

    await polls.workOff();

    const raised = react.mock.calls[0]?.[2];
    expect(raised).toHaveLength(1);
    expect(raised?.[0]?.concerns.marks.map((each) => each.value)).toEqual([
      'ENG-1',
    ]);
  });

  it('keeps the cursor the response named, and marks it run', async () => {
    const { polls, saved } = working();

    await polls.workOff();

    expect(saved).toHaveBeenCalledWith(TEAM, 'linear', 'ENG-2', NOW);
  });

  it('does not poll one that is not yet due', async () => {
    const { polls, run } = working({
      cursor: 'ENG-0',
      ranAt: new Date(NOW.getTime() - 30_000),
    });

    await polls.workOff();

    expect(run).not.toHaveBeenCalled();
  });

  it('polls one due again after its interval', async () => {
    const { polls, run } = working({
      cursor: 'ENG-0',
      ranAt: new Date(NOW.getTime() - 61_000),
    });

    await polls.workOff();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('keeps its cursor and does not react when a host refuses', async () => {
    const react = vi.fn(async () => undefined);
    const saved = vi.fn(async () => undefined);
    const run = vi.fn(
      async (): Promise<OutboundResult> => ({
        ok: false,
        status: 500,
        response: null,
        capture: {},
      }),
    );

    const failing = new WorkOffPolls(
      { all: async () => [config()] } as unknown as TeamConfigurationRepository,
      new IntegrationReader(),
      {
        ofTeam: async () =>
          Factory.of({
            id: FactoryId.of('factory_1'),
            workspaceId: WorkspaceId.of('ws_1'),
            teamId: TEAM,
          }),
      } as unknown as FactoryRepository,
      { resolve: async () => 'lin_1' } as unknown as TeamSecretsPort,
      {
        read: async () => ({ cursor: 'ENG-0', ranAt: null }),
        saved,
      } as unknown as IntegrationCursorsPort,
      { run } as unknown as HttpOutbound,
      { token: async () => null } as unknown as OAuth2Access,
      { react } as unknown as HappeningReactionsPort,
      { now: () => NOW } as ClockPort,
      { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    );

    await failing.workOff();

    expect(react).not.toHaveBeenCalled();
    // The poll is still marked run at the same cursor, so it retries next time
    // it is due rather than hammering the host every tick.
    expect(saved).toHaveBeenCalledWith(TEAM, 'linear', 'ENG-0', NOW);
  });
});
