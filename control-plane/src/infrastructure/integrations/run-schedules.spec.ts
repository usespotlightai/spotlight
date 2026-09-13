import type { ClockPort } from '@application/ports/clock.port';
import type {
  IntegrationCursorsPort,
  PollState,
} from '@application/ports/integration-cursors.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import { RunSchedules } from '@infrastructure/integrations/run-schedules';
import type {
  HttpOutbound,
  OutboundResult,
} from '@infrastructure/outbound/http-outbound';
import { describe, expect, it, vi } from 'vitest';

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
  TeamConfiguration.read({
    teamId: TEAM,
    repository: Repository.of('acme/api'),
    commit: Commit.of('abc1234'),
    files: [
      ConfigurationFile.of('.spotlight/integrations/linear.yml', SCHEDULE),
    ],
    problems: [],
    readAt: NOW,
  });

const OK: OutboundResult = { ok: true, status: 200, response: {}, capture: {} };

const working = (state: PollState, now: Date = NOW) => {
  const run = vi.fn(
    async (_request: unknown, _against: { secret: Record<string, string> }) =>
      OK,
  );
  const saved = vi.fn(async () => undefined);

  const schedules = new RunSchedules(
    { all: async () => [config()] } as unknown as TeamConfigurationRepository,
    new IntegrationReader(),
    {
      resolveAll: async (_team: unknown, names: readonly { value: string }[]) =>
        Object.fromEntries(names.map((name) => [name.value, 'lin_1'])),
    } as unknown as TeamSecretsPort,
    {
      read: async () => state,
      saved,
    } as unknown as IntegrationCursorsPort,
    { run } as unknown as HttpOutbound,
    { token: async () => null } as unknown as OAuth2Access,
    { now: () => now } as ClockPort,
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { schedules, run, saved };
};

describe('RunSchedules', () => {
  it('sets a clock going without firing when it first sees a schedule', async () => {
    const { schedules, run, saved } = working({ cursor: null, ranAt: null });

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(saved).toHaveBeenCalledWith(TEAM, 'linear:schedule', null, NOW);
  });

  it('runs the action when the cron has come round', async () => {
    const { schedules, run, saved } = working({
      cursor: null,
      ranAt: new Date('2026-09-07T08:00:00.000Z'),
    });

    await schedules.runDue();

    expect(run).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(TEAM, 'linear:schedule', null, NOW);
  });

  it('leaves a schedule alone until its cron comes round', async () => {
    const { schedules, run, saved } = working(
      { cursor: null, ranAt: new Date('2026-09-07T09:00:00.000Z') },
      new Date('2026-09-07T09:30:00.000Z'),
    );

    await schedules.runDue();

    expect(run).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
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
});
