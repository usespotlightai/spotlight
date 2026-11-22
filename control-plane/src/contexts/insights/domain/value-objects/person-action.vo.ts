import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import type { LabelSource } from '@insights/domain/value-objects/label-source';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const DECIDING_ACTIONS = [
  'started',
  'parked',
  'accepted',
  'sent-back',
  'held-as-wrong',
] as const;

export const RUN_HUMAN_ACTIONS = [...DECIDING_ACTIONS, 'answered'] as const;

const APPROVAL_ANSWERS = ['approved', 'dismissed'] as const;

const ACTION_KINDS = [...RUN_HUMAN_ACTIONS, ...APPROVAL_ANSWERS] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

export type RunHumanAction = (typeof RUN_HUMAN_ACTIONS)[number];

export type DecidingActionKind = (typeof DECIDING_ACTIONS)[number];

const FIRST_AT_THE_SAME_MOMENT: readonly ActionKind[] = [
  'held-as-wrong',
  'sent-back',
  'accepted',
  'parked',
  'started',
];

const LABEL_OF: Record<ActionKind, LabelSource | null> = {
  started: null,
  parked: null,
  accepted: 'accepted',
  answered: null,
  'sent-back': 'sent-back',
  'held-as-wrong': 'held-as-wrong',
  approved: null,
  dismissed: null,
};

export const actionKindOf = (raw: string): ActionKind | null =>
  ACTION_KINDS.find((each) => each === raw) ?? null;

export interface ActedOnTool {
  readonly tool: string | null;
  readonly server: string | null;
}

export class PersonAction {
  private constructor(
    readonly kind: ActionKind,
    readonly at: Date,
    readonly by: UserId,
  ) {}

  static of(kind: ActionKind, at: Date, by: UserId): PersonAction {
    return new PersonAction(kind, at, by);
  }

  get decidingKind(): DecidingActionKind | null {
    return DECIDING_ACTIONS.find((each) => each === this.kind) ?? null;
  }

  get answersApproval(): boolean {
    return APPROVAL_ANSWERS.some((each) => each === this.kind);
  }

  get answersQuestion(): boolean {
    return this.kind === 'answered';
  }

  get labelFrom(): LabelSource | null {
    return LABEL_OF[this.kind];
  }

  dismissalOf(acted: ActedOnTool): Dismissal | null {
    return this.kind === 'dismissed' && acted.tool
      ? Dismissal.of({ tool: acted.tool, server: acted.server, at: this.at })
      : null;
  }

  precedes(other: PersonAction): boolean {
    const sooner = this.at.getTime() - other.at.getTime();

    return sooner === 0
      ? FIRST_AT_THE_SAME_MOMENT.indexOf(this.kind) <
          FIRST_AT_THE_SAME_MOMENT.indexOf(other.kind)
      : sooner < 0;
  }
}
