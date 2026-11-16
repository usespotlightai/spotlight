import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { followedAtOf } from '@insights/domain/services/followed-run';
import { endedRecord, endOf, WORKSPACE } from '@insights/runs.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const FIRST = new Date('2026-09-30T10:00:00.000Z');
const SECOND = new Date('2026-09-30T11:00:00.000Z');
const THIRD = new Date('2026-09-30T12:00:00.000Z');

const first = endedRecord('run_1', { endedAt: FIRST });

describe('followedAtOf', () => {
  it('reads when the station’s next completed run on the task ended', () => {
    expect(
      followedAtOf(first, [
        first,
        endedRecord('run_3', { endedAt: THIRD, visit: 3 }),
        endedRecord('run_2', { endedAt: SECOND, visit: 2 }),
      ]),
    ).toEqual(SECOND);
  });

  it('is null for the station’s last completed run on the task', () => {
    expect(
      followedAtOf(endedRecord('run_2', { endedAt: SECOND }), [
        first,
        endedRecord('run_2', { endedAt: SECOND }),
      ]),
    ).toBeNull();
  });

  it.each(['failed', 'stopped', 'exhausted', 'cancelled'] as const)(
    'is not followed by a later run that %s',
    (ending) => {
      expect(
        followedAtOf(first, [
          endedRecord('run_2', { endedAt: SECOND, ending }),
        ]),
      ).toBeNull();
    },
  );

  it('is not followed by a later run its task superseded', () => {
    expect(
      followedAtOf(first, [
        endedRecord('run_2', { endedAt: SECOND }).supersededByItsTask(SECOND),
      ]),
    ).toBeNull();
  });

  it('is not followed by a run at another station or on another task', () => {
    expect(
      followedAtOf(first, [
        endedRecord('run_2', { endedAt: SECOND, stationId: 'station_2' }),
        endedRecord('run_3', { endedAt: SECOND, taskId: 'task_2' }),
      ]),
    ).toBeNull();
  });

  it('is not followed by a run on a task of the same id in another workspace', () => {
    expect(
      followedAtOf(first, [
        RunRecord.empty(RunId.of('run_2'), WorkspaceId.of('ws_2')).recordEnd(
          endOf({ endedAt: SECOND }),
        ),
      ]),
    ).toBeNull();
  });

  it('lets the run of the greater id follow a run that ended at the same moment', () => {
    const twin = endedRecord('run_2', { endedAt: FIRST });

    expect(followedAtOf(first, [first, twin])).toEqual(FIRST);
    expect(followedAtOf(twin, [first, twin])).toBeNull();
  });

  it('is null for a run that has not ended', () => {
    expect(
      followedAtOf(RunRecord.empty(RunId.of('run_0'), WORKSPACE), [
        endedRecord('run_2', { endedAt: SECOND }),
      ]),
    ).toBeNull();
  });
});
