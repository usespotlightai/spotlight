import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { deliveredOf, historyOf } from '@outcomes/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import { changeVerdictOf } from '@outcomes/domain/services/change-verdict';
import {
  memoryComparisonFrom,
  memoryCountsOf,
} from '@outcomes/domain/services/memory-comparison';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T10:00:00.000Z');
const WINDOW = {
  from: new Date('2026-09-01T00:00:00.000Z'),
  to: new Date('2026-10-01T00:00:00.000Z'),
};

describe('memoryCountsOf', () => {
  const records = [
    endedRecord('run_1', { taskId: 'task_1' })
      .actedOn(NextAct.of('closed', AT))
      .usedMemories('briefed', ['mem_1', 'mem_2']),
    endedRecord('run_2', { taskId: 'task_2' }).actedOn(
      NextAct.of('sent-back', AT),
    ),
    endedRecord('run_3', { taskId: 'task_3' }).usedMemories('recalled', [
      'mem_2',
    ]),
    endedRecord('run_4', {
      taskId: 'task_4',
      ending: 'withdrawn',
    }).usedMemories('briefed', ['mem_3']),
    endedRecord('run_5', {
      taskId: 'task_5',
      endedAt: new Date('2026-08-01T10:00:00.000Z'),
    }).usedMemories('briefed', ['mem_4']),
  ];

  it('sets the runs briefed or reading memories against the rest', () => {
    const compared = memoryComparisonFrom(
      memoryCountsOf(historyOf({ records }), WINDOW),
    );

    expect(compared.withMemories.runs).toBe(2);
    expect(compared.withMemories.accepted).toBe(1);
    expect(compared.withoutMemories.runs).toBe(1);
    expect(compared.withoutMemories.sentBack).toBe(1);
    expect(compared.runsBriefed).toBe(1);
    expect(compared.runsRecalled).toBe(1);
  });

  it('counts the memories a withdrawn run used, but not the run, and nothing outside the window', () => {
    const counts = memoryCountsOf(historyOf({ records }), WINDOW);

    expect(counts.memoriesBriefed).toBe(3);
    expect(counts.memoriesRecalled).toBe(1);
    expect(counts.withMemories.tally.withdrawn).toBe(0);
  });
});

describe('verdicts from counts', () => {
  const seeded = (seed: number) => {
    let state = seed;

    return () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    };
  };

  it('agree with the verdicts the runs give, measure by measure', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const random = seeded(seed);
      const pick = <T>(from: readonly T[]): T =>
        from[Math.floor(random() * from.length)] as T;
      const records: RunRecord[] = [];
      const deliveries = [];

      for (let index = 0; index < 40; index += 1) {
        const taskId = `task_${Math.floor(index / 2)}`;
        const runId = `run_${String(index).padStart(2, '0')}`;
        const endedAt = new Date(AT.getTime() - (40 - index) * 60_000);
        let record =
          random() < 0.8
            ? costedRecord(runId, {
                taskId,
                endedAt,
                ending: pick(['completed', 'failed', 'stopped', 'withdrawn']),
                amount:
                  random() < 0.85 ? Math.round(random() * 1000) / 7 : null,
                currency: seed % 3 === 0 && random() < 0.2 ? 'EUR' : 'USD',
              })
            : endedRecord(runId, { taskId, endedAt });

        if (random() < 0.6) {
          record = record.actedOn(
            NextAct.of(pick(['closed', 'sent-back', 'parked']), AT),
          );
        }
        if (random() < 0.5) {
          record = record.checked(pick(['passed', 'failed', 'skipped']), AT);
        }

        records.push(record);

        if (index % 2 === 0 && random() < 0.6) {
          deliveries.push(
            deliveredOf(taskId, {
              openedAt: AT,
              closedAt: random() < 0.7 ? AT : undefined,
              merged: random() < 0.6,
            }),
          );
        }
      }

      const before = records.filter((_, at) => at % 3 !== 0);
      const after = records.filter((_, at) => at % 3 === 0);
      const counts = memoryCountsOf(
        historyOf({
          records: [
            ...before,
            ...after.map((each) => each.usedMemories('briefed', ['mem_1'])),
          ],
          deliveries,
        }),
        WINDOW,
      );

      expect(memoryComparisonFrom(counts).verdicts).toEqual(
        changeVerdictOf(before, after, deliveries),
      );
    }
  });
});
