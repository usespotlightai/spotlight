const REASON_LIMIT = 1_000;

export class DeliveryFailure {
  private constructor(
    readonly reason: string,
    readonly transient: boolean,
  ) {}

  static transient(reason: string): DeliveryFailure {
    return new DeliveryFailure(reason.slice(0, REASON_LIMIT), true);
  }

  static permanent(reason: string): DeliveryFailure {
    return new DeliveryFailure(reason.slice(0, REASON_LIMIT), false);
  }

  equals(other: DeliveryFailure): boolean {
    return this.reason === other.reason && this.transient === other.transient;
  }
}
