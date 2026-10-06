export class RenewalClaim {
  private constructor(readonly until: Date) {}

  static from(now: Date, leaseMs: number): RenewalClaim {
    return new RenewalClaim(new Date(now.getTime() + leaseMs));
  }

  static until(until: Date): RenewalClaim {
    return new RenewalClaim(until);
  }

  heldAt(now: Date): boolean {
    return this.until.getTime() > now.getTime();
  }

  equals(other: RenewalClaim): boolean {
    return this.until.getTime() === other.until.getTime();
  }
}
