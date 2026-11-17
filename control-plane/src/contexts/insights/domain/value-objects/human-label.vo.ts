import type { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import {
  type LabelSource,
  passesOn,
} from '@insights/domain/value-objects/label-source';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface LabelledRun {
  readonly firstHumanAction: HumanAction | null;
  readonly merged: boolean;
  readonly ending: RunEnding;
  readonly followedAt: Date | null;
}

export class HumanLabel {
  private constructor(
    readonly from: LabelSource,
    readonly by: UserId | null,
  ) {}

  static of(run: LabelledRun): HumanLabel | null {
    const action = run.firstHumanAction;

    if (action?.labelFrom) {
      return new HumanLabel(action.labelFrom, action.by);
    }

    return run.merged && run.ending === 'completed' && run.followedAt === null
      ? new HumanLabel('merged', null)
      : null;
  }

  get passes(): boolean {
    return passesOn(this.from);
  }

  agreesWith(judge: { readonly passes: boolean }): boolean {
    return judge.passes === this.passes;
  }
}
