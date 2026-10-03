export const NEXT_ACTS = [
  'started',
  'parked',
  'closed',
  'answered',
  'sent-back',
] as const;

const APPROVAL_ANSWERS = ['approved', 'refused'] as const;

const PERSON_ACTS = [...NEXT_ACTS, ...APPROVAL_ANSWERS] as const;

export type PersonAct = (typeof PERSON_ACTS)[number];

export type NextActKind = (typeof NEXT_ACTS)[number];

const FIRST_AT_THE_SAME_MOMENT: readonly PersonAct[] = [
  'sent-back',
  'closed',
  'answered',
  'parked',
  'started',
];

export const personActOf = (raw: string): PersonAct | null =>
  PERSON_ACTS.find((each) => each === raw) ?? null;

export class NextAct {
  private constructor(
    readonly act: PersonAct,
    readonly at: Date,
  ) {}

  static of(act: PersonAct, at: Date): NextAct {
    return new NextAct(act, at);
  }

  get answersApproval(): boolean {
    return APPROVAL_ANSWERS.some((each) => each === this.act);
  }

  get accepts(): boolean {
    return this.act === 'closed';
  }

  get sendsBack(): boolean {
    return this.act === 'sent-back';
  }

  before(other: NextAct): boolean {
    const sooner = this.at.getTime() - other.at.getTime();

    return sooner === 0
      ? FIRST_AT_THE_SAME_MOMENT.indexOf(this.act) <
          FIRST_AT_THE_SAME_MOMENT.indexOf(other.act)
      : sooner < 0;
  }
}
