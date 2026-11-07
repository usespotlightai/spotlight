import type { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';

export const runOutcomeText = (outcome: RunOutcome): string | null => {
  if (outcome.stopped) {
    return 'A person stopped the run.';
  }

  switch (outcome.failure?.code) {
    case 'unprovisioned':
      return `No runner was provisioned after ${outcome.attempts} attempts. Last failure: ${outcome.detail}`;
    case 'start-gate-unanswered':
      return `No answer came on whether the run may start after ${outcome.attempts} tries. Last error: ${outcome.detail}`;
    case 'runner-lost':
      return `No runner finished the run after ${outcome.attempts} attempts.`;
    case 'timed-out':
      return `Sandbox stopped at the host's time limit. No runner finished the run after ${outcome.attempts} attempts.`;
    default:
      return outcome.detail;
  }
};
