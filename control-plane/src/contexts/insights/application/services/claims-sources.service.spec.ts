import {
  type CommittedLine,
  ClaimsSources,
} from '@insights/application/services/claims-sources.service';
import { ClaimsSourceVersionConflictError } from '@insights/domain/exceptions/claims-source-version-conflict.error';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { clockAt } from '@insights/judge-repair-setup.fake-spec';
import { ClaimsSourcesInMemory } from '@insights/judge-repair.fake-spec';
import { inTransaction } from '@insights/runs.fake-spec';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { describe, expect, it } from 'vitest';

const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';

const LATER_SHA = '9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b';

const NOW = new Date('2026-11-14T09:00:00Z');

const FIRST = RubricVersion.of('a'.repeat(64));

const SECOND = RubricVersion.of('b'.repeat(64));

const applied = (over: Partial<CommittedLine> = {}): CommittedLine => ({
  lineId: 'line_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  deleted: false,
  stations: [
    { id: 'station_1', rubricVersion: FIRST, claimsChanged: true },
    { id: 'station_2', rubricVersion: null, claimsChanged: false },
  ],
  sourceCommit: { repository: 'acme/config', sha: SHA },
  ...over,
});

const sourcing = (sources = new ClaimsSourcesInMemory()) => ({
  sources,
  service: new ClaimsSources(sources, inTransaction, clockAt(NOW)),
});

describe('ClaimsSources', () => {
  it('keeps the commit of each judged station a change came from', async () => {
    const { sources, service } = sourcing();

    await service.lineChanged(applied());

    const [source] = await sources.ofStation(StationId.of('station_1'));
    expect(source?.commit.toString()).toBe(`acme/config@${SHA}`);
    expect(source?.rubricVersion).toBe(FIRST);
    expect(source?.recordedAt).toEqual(NOW);
    expect(source?.hasPendingJob).toBe(true);
    expect(await sources.ofStation(StationId.of('station_2'))).toEqual([]);
    expect(sources.events.map((each) => each.kind)).toEqual([
      'claims-source.recorded',
    ]);
  });

  it('keeps no commit for a station whose claims the change left alone', async () => {
    const { sources, service } = sourcing();

    await service.lineChanged(
      applied({
        stations: [
          { id: 'station_1', rubricVersion: FIRST, claimsChanged: false },
          { id: 'station_3', rubricVersion: SECOND, claimsChanged: true },
        ],
      }),
    );

    expect(await sources.ofStation(StationId.of('station_1'))).toEqual([]);
    expect(
      (await sources.find(StationId.of('station_3'), SECOND))?.commit.sha,
    ).toBe(SHA);
  });

  it('keeps the first commit of a claims version when the same claims are applied again', async () => {
    const { sources, service } = sourcing();

    await service.lineChanged(applied());
    await service.lineChanged(
      applied({ sourceCommit: { repository: 'acme/config', sha: LATER_SHA } }),
    );

    const kept = await sources.find(StationId.of('station_1'), FIRST);
    expect(kept?.commit.sha).toBe(SHA);
    expect(sources.stored.size).toBe(1);
  });

  it('keeps a new commit for new claims', async () => {
    const { sources, service } = sourcing();

    await service.lineChanged(applied());
    await service.lineChanged(
      applied({
        stations: [
          { id: 'station_1', rubricVersion: SECOND, claimsChanged: true },
        ],
        sourceCommit: { repository: 'acme/config', sha: LATER_SHA },
      }),
    );

    expect(
      (await sources.find(StationId.of('station_1'), SECOND))?.commit.sha,
    ).toBe(LATER_SHA);
  });

  it('takes a commit another delivery kept first as already kept, and goes on with the other stations', async () => {
    const sources = new ClaimsSourcesInMemory();
    const { service: other } = sourcing(sources);
    const racing = new ClaimsSourcesInMemory();
    let raced = false;
    racing.find = async (stationId, rubricVersion) => {
      if (!raced) {
        raced = true;
        await other.lineChanged(
          applied({
            sourceCommit: { repository: 'acme/config', sha: LATER_SHA },
          }),
        );
        return null;
      }
      return sources.find(stationId, rubricVersion);
    };
    racing.add = async (source) => {
      if (await sources.find(source.station.stationId, source.rubricVersion)) {
        throw new ClaimsSourceVersionConflictError(
          source.station.stationId.value,
          source.rubricVersion,
        );
      }
      await sources.add(source);
    };
    const { service } = sourcing(racing);

    await service.lineChanged(
      applied({
        stations: [
          { id: 'station_1', rubricVersion: FIRST, claimsChanged: true },
          { id: 'station_3', rubricVersion: SECOND, claimsChanged: true },
        ],
      }),
    );

    expect(
      (await sources.find(StationId.of('station_1'), FIRST))?.commit.sha,
    ).toBe(LATER_SHA);
    expect(
      (await sources.find(StationId.of('station_3'), SECOND))?.commit.sha,
    ).toBe(SHA);
  });

  it.each([
    ['no commit', { sourceCommit: null }],
    ['a deleted line', { deleted: true }],
  ])('keeps nothing for %s', async (_why, over) => {
    const { sources, service } = sourcing();

    await service.lineChanged(applied(over));

    expect(sources.stored.size).toBe(0);
  });
});
