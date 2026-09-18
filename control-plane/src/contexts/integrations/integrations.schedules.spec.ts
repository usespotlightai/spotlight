import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import type { TeamSecretsPort } from '@configuration/application/ports/team-secrets.port';
import type { PollState } from '@integrations/application/ports/integration-cursors.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { RunSchedules } from '@integrations/application/services/run-schedules.service';
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

const NOW = new Date('2026-09-07T09:00:00.000Z');
const TEAM = TeamId.of('team_1');

const SCHEDULE = `
version: 1
integration: linear
schedule:
  cron: 0 * * * *
  do: digest
actions:
  digest:
    request:
      method: POST
      url: https://api.linear.app/digest
      headers:
        authorization: '\${{ "Bearer " + secret.LINEAR_TOKEN }}'
`;

const config = () =>
  ({
    teamId: TEAM,
    repository: Repository.of('acme/api'),
    files: [
      ConfigurationFile.of('.spotlight/integrations/linear.yml', SCHEDULE),
    ],
  }) as Applied;

const OK: OutboundResult = { ok: true, status: 200, response: {}, capture: {} };

const KEY = 'linear:schedule';

const scheduling = (
  cursors: FakeIntegrationCursors,
  run: (
    request: unknown,
    against: { secret: Record<string, string> },
  ) => Promise<OutboundResult>,
  now: Date = NOW,
) =>
  new RunSchedules(
    {
      everywhere: async () => [config()],
    } as unknown as AppliedConfigurationPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    new HostReach(
      {
        resolveAll: async (
          _team: unknown,
          names: readonly { value: string }[],
        ) => Object.fromEntries(names.map((name) => [name.value, 'lin_1'])),
      } as unknown as TeamSecretsPort,
      { of: async () => null } as unknown as HostConnectionRepository,
    ),
    cursors,
    { now: () => now } as ClockPort,
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

const working = (state: PollState, now: Date = NOW) => {
  const run = vi.fn(
    async (_request: unknown, _against: { secret: Record<string, string> }) =>
      OK,
  );
  const cursors = new FakeIntegrationCursors();

  if (state.ranAt) {
    cursors.keep(TEAM, KEY, state);
  }

  return { schedules: scheduling(cursors, run, now), run, cursors };
};

describe('RunSchedules', () => {
  it('sets a clock going without firing when it first sees a schedule', async () => {
    const { schedules, run, cursors } = working({ cursor: null, ranAt: null });

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(cursors.kept(TEAM, KEY)?.ranAt).toEqual(NOW);
  });

  it('runs the action when the cron has come round', async () => {
    const { schedules, run, cursors } = working({
      cursor: null,
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });

    await schedules.runDue();

    expect(run).toHaveBeenCalledTimes(1);
    expect(cursors.kept(TEAM, KEY)?.ranAt).toEqual(NOW);
  });

  it('leaves a schedule alone until its cron comes round', async () => {
    const { schedules, run, cursors } = working(
      { cursor: null, ranAt: new Date('2026-09-07T09:00:00.000Z') },
      new Date('2026-09-07T09:30:00.000Z'),
    );

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(cursors.kept(TEAM, KEY)?.ranAt).toEqual(
      new Date('2026-09-07T09:00:00.000Z'),
    );
  });

  it('fires once for a schedule that fell behind, not once per missed hour', async () => {
    const { schedules, run } = working({
      cursor: null,
      ranAt: new Date('2026-09-06T08:00:00.000Z'),
    });

    await schedules.runDue();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reads the action with the team secret', async () => {
    const { schedules, run } = working({
      cursor: null,
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });

    await schedules.runDue();

    const [request, against] = run.mock.calls[0] ?? [];
    expect(request).toBeDefined();
    expect(against?.secret.LINEAR_TOKEN).toBe('lin_1');
  });

  it('runs the action once when two workers reach the slot together', async () => {
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
    cursors.keep(TEAM, KEY, {
      cursor: null,
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });
    const run = vi.fn(async () => OK);

    await Promise.all([
      scheduling(cursors, run).runDue(),
      scheduling(cursors, run).runDue(),
    ]);

    expect(run).toHaveBeenCalledTimes(1);
  });
});
