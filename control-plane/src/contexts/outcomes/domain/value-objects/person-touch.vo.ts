import type { PersonAct } from '@outcomes/domain/value-objects/next-act.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class PersonTouch {
  private constructor(
    readonly act: PersonAct,
    readonly by: UserId,
    readonly stationId: string,
    readonly at: Date,
  ) {}

  static of(input: {
    act: PersonAct;
    by: UserId;
    stationId: string;
    at: Date;
  }): PersonTouch {
    return new PersonTouch(input.act, input.by, input.stationId, input.at);
  }

  get refuses(): boolean {
    return this.act === 'refused';
  }

  equals(other: PersonTouch): boolean {
    return (
      this.act === other.act &&
      this.by.equals(other.by) &&
      this.stationId === other.stationId &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
