import { runOutcomeText } from '@runs/application/rendering/run-outcome.text';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { describe, expect, it } from 'vitest';

describe('runOutcomeText', () => {
  it.each([
    [
      RunOutcome.unprovisioned({ description: 'http-error: no' }, 5),
      'No runner was provisioned after 5 attempts. Last failure: http-error: no',
    ],
    [
      RunOutcome.unanswered('connect refused', 6),
      'No answer came on whether the run may start after 6 tries. Last error: connect refused',
    ],
    [RunOutcome.lost(3), 'No runner finished the run after 3 attempts.'],
    [
      RunOutcome.timedOut(3),
      "Sandbox stopped at the host's time limit. No runner finished the run after 3 attempts.",
    ],
    [RunOutcome.stopped(ExitCode.clean()), 'A person stopped the run.'],
    [RunOutcome.cancelled('The task moved on.'), 'The task moved on.'],
    [RunOutcome.refused([{ description: 'a' }, { description: 'b' }]), 'a; b'],
    [
      RunOutcome.of({
        exitCode: ExitCode.of(1),
        failed: true,
        message: ' It exited. ',
      }),
      'It exited.',
    ],
    [RunOutcome.of({ exitCode: ExitCode.clean(), failed: false }), null],
  ])('words %o from its code and facts', (outcome, text) => {
    expect(runOutcomeText(outcome)).toBe(text);
  });
});
