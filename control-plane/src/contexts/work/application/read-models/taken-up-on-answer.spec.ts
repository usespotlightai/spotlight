import { takenUpOnAnswer } from '@work/application/read-models/taken-up-on-answer';
import { describe, expect, it } from 'vitest';

describe('takenUpOnAnswer', () => {
  it("takes up the task's current run once nobody owes an answer", () => {
    expect(
      takenUpOnAnswer('run_1', { currentRunId: 'run_1', awaitsPerson: false }),
    ).toBe(true);
  });

  it('takes up no run while a person owes an answer, nor a run the task left', () => {
    expect(
      takenUpOnAnswer('run_1', { currentRunId: 'run_1', awaitsPerson: true }),
    ).toBe(false);
    expect(
      takenUpOnAnswer('run_1', { currentRunId: 'run_2', awaitsPerson: false }),
    ).toBe(false);
  });
});
