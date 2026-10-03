export const PERSON_ACTS = [
  'started',
  'parked',
  'closed',
  'answered',
  'approved',
  'refused',
  'sent-back',
] as const;

export type PersonAct = (typeof PERSON_ACTS)[number];

const ACCEPTING: readonly PersonAct[] = ['closed', 'approved'];

const SENDING_BACK: readonly PersonAct[] = ['sent-back', 'refused'];

export const personActOf = (raw: string): PersonAct | null =>
  PERSON_ACTS.find((each) => each === raw) ?? null;

export class NextAct {
  private constructor(
    readonly act: PersonAct,
    readonly at: Date,
    readonly forApproval: boolean,
  ) {}

  static of(act: PersonAct, at: Date): NextAct {
    return new NextAct(act, at, false);
  }

  static onApproval(act: PersonAct, at: Date): NextAct {
    return new NextAct(act, at, true);
  }

  get accepts(): boolean {
    return ACCEPTING.includes(this.act);
  }

  get sendsBack(): boolean {
    return SENDING_BACK.includes(this.act);
  }
}
