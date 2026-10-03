import { endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import { memoryComparisonOf } from '@outcomes/domain/services/memory-comparison';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { describe, expect, it } from 'vitest';

describe('memoryComparisonOf', () => {
  const at = new Date('2026-09-30T10:00:00.000Z');
  const records = [
    endedRecord('run_1', { taskId: 'task_1' }).actedOn(
      NextAct.of('closed', at),
    ),
    endedRecord('run_2', { taskId: 'task_2' }).actedOn(
      NextAct.of('sent-back', at),
    ),
    endedRecord('run_3', { taskId: 'task_3' }),
    endedRecord('run_4', { taskId: 'task_4', ending: 'withdrawn' }),
  ];

  it('sets runs briefed or reading memories against the rest', () => {
    const compared = memoryComparisonOf(
      records,
      [
        { runId: 'run_1', briefed: 2, recalled: 0 },
        { runId: 'run_3', briefed: 0, recalled: 1 },
      ],
      [],
    );

    expect(compared.withMemories.runs).toBe(2);
    expect(compared.withMemories.accepted).toBe(1);
    expect(compared.withoutMemories.runs).toBe(1);
    expect(compared.withoutMemories.sentBack).toBe(1);
    expect(compared.runsBriefed).toBe(1);
    expect(compared.runsRecalled).toBe(1);
  });

  it('counts no use by runs outside the ones compared', () => {
    const compared = memoryComparisonOf(
      records,
      [
        { runId: 'run_other', briefed: 3, recalled: 0 },
        { runId: 'run_4', briefed: 1, recalled: 0 },
      ],
      [],
    );

    expect(compared.withMemories.runs).toBe(0);
    expect(compared.runsBriefed).toBe(0);
  });
});
