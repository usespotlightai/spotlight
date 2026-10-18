export const TASK_ACTIONS = [
  'started',
  'parked',
  'accepted',
  'answered',
  'sent-back',
] as const;

const APPROVAL_ANSWERS = ['approved', 'dismissed'] as const;

const HUMAN_ACTION_KINDS = [...TASK_ACTIONS, ...APPROVAL_ANSWERS] as const;

export type HumanActionKind = (typeof HUMAN_ACTION_KINDS)[number];

export type TaskAction = (typeof TASK_ACTIONS)[number];

const FIRST_AT_THE_SAME_MOMENT: readonly HumanActionKind[] = [
  'sent-back',
  'accepted',
  'answered',
  'parked',
  'started',
];

export const humanActionKindOf = (raw: string): HumanActionKind | null =>
  HUMAN_ACTION_KINDS.find((each) => each === raw) ?? null;

export class HumanAction {
  private constructor(
    readonly kind: HumanActionKind,
    readonly at: Date,
  ) {}

  static of(kind: HumanActionKind, at: Date): HumanAction {
    return new HumanAction(kind, at);
  }

  get answersApproval(): boolean {
    return APPROVAL_ANSWERS.some((each) => each === this.kind);
  }

  get accepts(): boolean {
    return this.kind === 'accepted';
  }

  get sendsBack(): boolean {
    return this.kind === 'sent-back';
  }

  before(other: HumanAction): boolean {
    const sooner = this.at.getTime() - other.at.getTime();

    return sooner === 0
      ? FIRST_AT_THE_SAME_MOMENT.indexOf(this.kind) <
          FIRST_AT_THE_SAME_MOMENT.indexOf(other.kind)
      : sooner < 0;
  }
}
