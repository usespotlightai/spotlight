import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import {
  type LabelSource,
  passesOn,
} from '@insights/domain/value-objects/label-source';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const TASK_ACTIONS = [
  'started',
  'parked',
  'accepted',
  'answered',
  'sent-back',
  'held',
] as const;

const APPROVAL_ANSWERS = ['approved', 'dismissed'] as const;

const HUMAN_ACTION_KINDS = [...TASK_ACTIONS, ...APPROVAL_ANSWERS] as const;

export type HumanActionKind = (typeof HUMAN_ACTION_KINDS)[number];

export type TaskAction = (typeof TASK_ACTIONS)[number];

const FIRST_AT_THE_SAME_MOMENT: readonly HumanActionKind[] = [
  'held',
  'sent-back',
  'accepted',
  'answered',
  'parked',
  'started',
];

const LABEL_OF: Record<HumanActionKind, LabelSource | null> = {
  started: null,
  parked: null,
  accepted: 'accepted',
  answered: null,
  'sent-back': 'sent-back',
  held: 'held',
  approved: null,
  dismissed: null,
};

export const humanActionKindOf = (raw: string): HumanActionKind | null =>
  HUMAN_ACTION_KINDS.find((each) => each === raw) ?? null;

export interface ActedOnTool {
  readonly tool: string | null;
  readonly server: string | null;
}

export class HumanAction {
  private constructor(
    readonly kind: HumanActionKind,
    readonly at: Date,
    readonly by: UserId | null,
  ) {}

  static of(
    kind: HumanActionKind,
    at: Date,
    by: UserId | null = null,
  ): HumanAction {
    return new HumanAction(kind, at, by);
  }

  get answersApproval(): boolean {
    return APPROVAL_ANSWERS.some((each) => each === this.kind);
  }

  get labelFrom(): LabelSource | null {
    return LABEL_OF[this.kind];
  }

  get accepts(): boolean {
    return this.labelFrom !== null && passesOn(this.labelFrom);
  }

  get rejectsRun(): boolean {
    return this.labelFrom !== null && !passesOn(this.labelFrom);
  }

  dismissalOf(acted: ActedOnTool): Dismissal | null {
    return this.kind === 'dismissed' && acted.tool
      ? Dismissal.of({ tool: acted.tool, server: acted.server, at: this.at })
      : null;
  }

  before(other: HumanAction): boolean {
    const sooner = this.at.getTime() - other.at.getTime();

    return sooner === 0
      ? FIRST_AT_THE_SAME_MOMENT.indexOf(this.kind) <
          FIRST_AT_THE_SAME_MOMENT.indexOf(other.kind)
      : sooner < 0;
  }
}
