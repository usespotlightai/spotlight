import type { RunFacts } from '@runs/application/ports/run-facts.port';
import type { UntrialableReasonCode } from '@work/application/contracts/untrialable-reason.contract';
import type { TrialArchive } from '@work/domain/services/trialability';
import type { UntrialableReason } from '@work/domain/value-objects/untrialable-reason';

const REASONS: Readonly<Record<UntrialableReason, UntrialableReasonCode>> = {
  'unknown-run': 'unknown-run',
  'not-a-task-run': 'not-a-task-run',
  'task-gone': 'task-gone',
  'still-running': 'still-running',
  'no-starting-point': 'no-starting-point',
  'no-briefing': 'no-briefing',
  'archive-gone': 'archive-gone',
  'attachments-gone': 'attachments-gone',
  'answer-gone': 'answer-gone',
  'repository-gone': 'repository-gone',
  'not-at-the-station': 'not-at-the-station',
  'candidate-unfit': 'candidate-unfit',
  'cannot-start': 'cannot-start',
};

export const TrialabilityMapper = {
  reasonCode(reason: UntrialableReason): UntrialableReasonCode {
    return REASONS[reason];
  },

  archiveOf(run: RunFacts): TrialArchive {
    if (!run.startedFrom?.archiveId) {
      return 'none';
    }

    return run.startedFrom.archiveStored ? 'stored' : 'gone';
  },
};
