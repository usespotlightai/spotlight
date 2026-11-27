import {
  type LabelSource,
  passesOn,
} from '@insights/domain/value-objects/label-source';
import type { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import type { PersonVerdict } from '@insights/domain/value-objects/person-verdict.vo';
import {
  leftWork,
  type RunEnding,
} from '@insights/domain/value-objects/run-ending';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface LabelEvidence {
  readonly ending: RunEnding;
  readonly decidingAction: PersonAction | null;
  readonly taskMerged: boolean;
  readonly followed: boolean;
  readonly personVerdict: PersonVerdict | null;
}

export class HumanLabel {
  private constructor(
    readonly from: LabelSource,
    readonly by: UserId | null,
  ) {}

  static of(run: LabelEvidence): HumanLabel | null {
    return run.personVerdict
      ? new HumanLabel(run.personVerdict.labelFrom, run.personVerdict.by)
      : HumanLabel.implicitOf(run);
  }

  static implicitOf(run: LabelEvidence): HumanLabel | null {
    const action = run.decidingAction;
    const from = action?.labelFrom;

    if (action && from) {
      return passesOn(from) && !leftWork(run.ending)
        ? null
        : new HumanLabel(from, action.by);
    }

    return run.taskMerged && run.ending === 'completed' && !run.followed
      ? new HumanLabel('merged', null)
      : null;
  }

  get passes(): boolean {
    return passesOn(this.from);
  }

  get mergedOnly(): boolean {
    return this.from === 'merged';
  }

  agreesWith(judge: { readonly passes: boolean }): boolean {
    return judge.passes === this.passes;
  }
}
