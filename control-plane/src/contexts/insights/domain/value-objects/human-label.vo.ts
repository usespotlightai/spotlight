import type { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import {
  LABEL_SOURCES,
  type LabelSource,
  passesOn,
} from '@insights/domain/value-objects/label-source';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class HumanLabel {
  private constructor(
    readonly from: LabelSource,
    readonly by: UserId | null,
  ) {}

  static ofAction(action: HumanAction): HumanLabel | null {
    const from = LABEL_SOURCES.find((each) => each === action.kind);

    return from ? new HumanLabel(from, action.by) : null;
  }

  static merged(): HumanLabel {
    return new HumanLabel('merged', null);
  }

  get passes(): boolean {
    return passesOn(this.from);
  }

  agreesWith(judge: { readonly passes: boolean }): boolean {
    return judge.passes === this.passes;
  }
}
