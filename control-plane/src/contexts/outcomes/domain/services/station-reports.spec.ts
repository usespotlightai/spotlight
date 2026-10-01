import {
  day,
  failuresOf,
  historyOf,
  touchesOf,
} from '@outcomes/domain/insights.fake-spec';
import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import { stationReportsOf } from '@outcomes/domain/services/station-reports';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

describe('stationReportsOf', () => {
  it('tallies each station this period and the one before, and per day', () => {
    const [report] = stationReportsOf(
      historyOf({
        records: [
          endedRecord('run_1', { endedAt: day('2026-09-26') }),
          endedRecord('run_2', {
            endedAt: day('2026-09-26', 15),
            ending: 'failed',
            failure: 'exited',
          }),
          endedRecord('run_3', { endedAt: day('2026-09-20') }),
        ],
      }),
      PERIOD,
    );

    expect(report?.tally).toMatchObject({ runs: 2, failed: 1 });
    expect(report?.before).toMatchObject({ runs: 1, failed: 0 });
    expect(report?.trend[1]).toMatchObject({
      day: '2026-09-26',
      tally: { runs: 2 },
    });
    expect(report?.runFailures).toEqual([
      { failure: 'exited', runs: 1, runIds: ['run_2'] },
    ]);
  });

  it('tells task failures by source and code apart from how runs ended', () => {
    const [report] = stationReportsOf(
      historyOf({
        records: [endedRecord('run_1', { endedAt: day('2026-09-26') })],
        failures: [
          failuresOf('task_1', [
            { at: day('2026-09-26', 9) },
            { occurrences: 2, at: day('2026-09-26', 10) },
            { occurrences: 3, at: day('2026-09-26', 11) },
            { source: 'run', code: 'exited', at: day('2026-09-20') },
          ]),
        ],
      }),
      PERIOD,
    );

    expect(report?.taskFailures).toEqual([
      {
        source: 'hook:notify',
        code: 'loop',
        occurrences: 3,
        mostInARow: 3,
        taskIds: ['task_1'],
      },
    ]);
    expect(report?.runFailures).toEqual([]);
  });

  it('reports a station whose only trouble this period was a looping hook', () => {
    const reports = stationReportsOf(
      historyOf({
        touches: [touchesOf('task_1', { lineId: 'line_2' })],
        failures: [
          failuresOf('task_1', [
            { stationId: 'station_9', at: day('2026-09-26') },
          ]),
        ],
      }),
      PERIOD,
    );

    expect(
      reports.map((each) => [
        each.lineId,
        each.stationId,
        each.tally.runs,
        each.taskFailures.length,
      ]),
    ).toEqual([['line_2', 'station_9', 0, 1]]);
  });
});
