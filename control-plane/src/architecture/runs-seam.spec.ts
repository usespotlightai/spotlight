import { describe, expect, it } from 'vitest';
import { ratchetProblems } from './known-violations';
import { runsSeamViolations, sideOf } from './runs-seam';
import { KNOWN_RUNS_SEAM_CROSSINGS } from './runs-seam.known';

describe('runs seam inside Work', () => {
  it('puts the run aggregate and its claim on the run side', () => {
    expect(
      [
        'contexts/work/domain/aggregates/run.aggregate.ts',
        'contexts/work/application/commands/handlers/claim-run.handler.ts',
        'contexts/work/infrastructure/persistence/drizzle/schemas/run.schema.ts',
      ].map(sideOf),
    ).toEqual(['run', 'run', 'run']);
  });

  it('puts the task and its readers on the work side', () => {
    expect(
      [
        'contexts/work/domain/aggregates/task.aggregate.ts',
        'contexts/work/infrastructure/persistence/drizzle/readers/task.reader.ts',
        'contexts/work/domain/events/run-briefed.event.ts',
      ].map(sideOf),
    ).toEqual(['work', 'work', 'work']);
  });

  it('leaves the composition root to neither side', () => {
    expect(sideOf('contexts/work/work.wiring.ts')).toBe('composition');
    expect(sideOf('contexts/lines/lines.wiring.ts')).toBeNull();
  });

  it('crosses the seam only through published ports, contracts and DTOs', () => {
    expect(
      ratchetProblems(runsSeamViolations(), KNOWN_RUNS_SEAM_CROSSINGS),
    ).toEqual([]);
  }, 60_000);
});
