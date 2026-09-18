import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import type { TeamSecretsPort } from '@configuration/application/ports/team-secrets.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { PollState } from '@integrations/application/ports/integration-cursors.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { WorkOffPolls } from '@integrations/application/services/work-off-polls.service';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { FakeIntegrationCursors } from '@integrations/integrations.cursors.fake-spec';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';
import { describe, expect, it, vi } from 'vitest';

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2Clients = OAuth2Clients.from('{}'),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
  );

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
  ({
    teamId: TEAM,
    repository: Repository.of('acme/api'),
    files: [ConfigurationFile.of('.spotlight/integrations/linear.yml', POLL)],
  }) as Applied;

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

const polling = (
  cursors: FakeIntegrationCursors,
  run: (
    request: unknown,
    against: { cursor: string },
  ) => Promise<OutboundResult>,
  react: HappeningReactionsPort['react'],
) =>
  new WorkOffPolls(
    {
      everywhere: async () => [config()],
    } as unknown as AppliedConfigurationPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    {
      find: async () => ({
        id: TEAM,
        workspaceId: WorkspaceId.of('ws_1'),
        name: 'Platform',
        members: [],
      }),
    } as unknown as TeamDirectoryPort,
    new HostReach(
      {
        resolveAll: async (
          _team: unknown,
          names: readonly { value: string }[],
        ) =>
          Object.fromEntries(
            names
              .filter((name) => name.value === 'LINEAR_TOKEN')
              .map((name) => [name.value, 'lin_1']),
          ),
      } as unknown as TeamSecretsPort,
      { of: async () => null } as unknown as HostConnectionRepository,
    ),
    cursors,
    { react } as HappeningReactionsPort,
    { now: () => NOW } as ClockPort,
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

const working = (state: PollState = { cursor: null, ranAt: null }) => {
  const run = vi.fn(
    async (_request: unknown, _against: { cursor: string }) => REPLY,
  );
  const react = vi.fn(
    async (_workspaceId: unknown, _teamId: unknown, _happenings: Happened[]) =>
      undefined,
  );
  const cursors = new FakeIntegrationCursors();

  if (state.ranAt || state.cursor) {
    cursors.keep(TEAM, 'linear', state);
  }

  return { polls: polling(cursors, run, react), run, react, cursors };
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
    const { polls, cursors } = working();

    await polls.workOff();

    expect(cursors.kept(TEAM, 'linear')).toEqual({
      cursor: 'ENG-2',
      ranAt: NOW,
    });
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
    const cursors = new FakeIntegrationCursors();
    cursors.keep(TEAM, 'linear', { cursor: 'ENG-0', ranAt: null });

    await polling(
      cursors,
      async () => ({ ok: false, status: 500, response: null, capture: {} }),
      react,
    ).workOff();

    expect(react).not.toHaveBeenCalled();
    expect(cursors.kept(TEAM, 'linear')).toEqual({
      cursor: 'ENG-0',
      ranAt: NOW,
    });
  });

  it('polls a slot once when two workers reach it together', async () => {
    let reads = 0;
    let bothRead: () => void = () => {};
    const together = new Promise<void>((settle) => {
      bothRead = settle;
    });
    const cursors = new FakeIntegrationCursors(async () => {
      reads += 1;
      if (reads === 2) {
        bothRead();
      }
      await together;
    });
    const run = vi.fn(async () => REPLY);
    const react = vi.fn(async () => undefined);

    await Promise.all([
      polling(cursors, run, react).workOff(),
      polling(cursors, run, react).workOff(),
    ]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(react).toHaveBeenCalledTimes(1);
  });

  it('will not move the cursor back when a later poll took the turn', async () => {
    const cursors = new FakeIntegrationCursors();
    const later = new Date(NOW.getTime() + 90_000);
    const react = vi.fn(async () => undefined);
    const run = vi.fn(async () => {
      cursors.keep(TEAM, 'linear', { cursor: 'ENG-9', ranAt: later });
      return REPLY;
    });

    await polling(cursors, run, react).workOff();

    expect(cursors.kept(TEAM, 'linear')).toEqual({
      cursor: 'ENG-9',
      ranAt: later,
    });
  });
});
