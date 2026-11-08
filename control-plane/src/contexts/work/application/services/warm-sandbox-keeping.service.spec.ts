import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WarmSandboxKeepingPort } from '@work/application/ports/warm-sandbox-keeping.port';
import { WarmSandboxKeeping } from '@work/application/services/warm-sandbox-keeping.service';
import {
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { WarmSandboxQuota } from '@work/domain/value-objects/warm-sandbox-quota.vo';
import { WarmShape } from '@work/domain/value-objects/warm-shape.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-08T12:00:00.000Z');

const line = LineMap.of({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('backlog'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('completed'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 1,
      kind: 'completed',
    }),
  ],
  repositories: LineRepositories.of(
    [repositoryOf(Repository.of('acme/widgets'))],
    null,
  ),
  warmSandboxes: WarmSandboxQuota.of(2),
});

const keepingWith = (over: { requestFails?: boolean } = {}) => {
  const sandboxes = {
    kept: vi.fn(async () => [
      {
        id: 'sandbox_old',
        lineId: line.id,
        shape: WarmShape.of('outdated'),
      },
    ]),
    linesLostSince: vi.fn(async () => []),
    request: vi.fn(async () => {
      if (over.requestFails) {
        throw new Error('runners down');
      }
    }),
    retire: vi.fn(async () => {}),
  } satisfies WarmSandboxKeepingPort;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerPort;
  const keeping = new WarmSandboxKeeping(
    { keepingWarmSandboxes: async () => [line] },
    sandboxes,
    { now: () => NOW, sleep: async () => {} },
    logger,
  );

  return { keeping, sandboxes, logger };
};

describe('WarmSandboxKeeping', () => {
  it('retires the outdated warm sandboxes and requests the missing ones, backing off from lines lost in the last 15 minutes', async () => {
    const { keeping, sandboxes } = keepingWith();

    await keeping.keep();

    expect(sandboxes.linesLostSince).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 15 * 60_000),
    );
    expect(sandboxes.retire).toHaveBeenCalledWith('sandbox_old');
    expect(sandboxes.request).toHaveBeenCalledTimes(2);
    expect(sandboxes.request).toHaveBeenCalledWith(
      { line, shape: WarmShape.ofLine(line) },
      NOW,
    );
  });

  it('goes on with the next request when one fails, and reports it', async () => {
    const { keeping, sandboxes, logger } = keepingWith({ requestFails: true });

    await keeping.keep();

    expect(sandboxes.request).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
