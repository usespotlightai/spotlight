import { checkoutPathOf } from '@runs/application/contracts/run-spec.contract';
import type { RunFacts } from '@runs/application/ports/run-facts.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { UntrialableReasonCode } from '@work/application/contracts/untrialable-reason.contract';
import type { TrialArchive } from '@work/domain/services/trialability';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { UntrialableReason } from '@work/domain/value-objects/untrialable-reason';

interface StartedCheckout {
  readonly path: string;
  readonly commit: string;
}

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
  'repository-missing': 'repository-missing',
  'not-at-the-station': 'not-at-the-station',
  'candidate-unfit': 'candidate-unfit',
  'cannot-start': 'cannot-start',
};

export const TrialabilityMapper = {
  reasonCode(reason: UntrialableReason): UntrialableReasonCode {
    return REASONS[reason];
  },

  archiveOf(run: RunFacts): TrialArchive {
    const from = run.startedFrom;

    if (from === null || from.archiveId === null || from.archiveId === '') {
      return 'none';
    }

    return from.archiveStored ? 'stored' : 'gone';
  },

  checkoutsIn(
    line: LineMap,
    checkouts: readonly StartedCheckout[],
  ): {
    readonly checkedOutAt: string;
    readonly repository: Repository | null;
    readonly commit: string;
  }[] {
    return checkouts.map((each) => ({
      checkedOutAt: each.path,
      repository:
        line.repositories.all.find(
          (repository) => checkoutPathOf(repository) === each.path,
        ) ?? null,
      commit: each.commit,
    }));
  },
};
