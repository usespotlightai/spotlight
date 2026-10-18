export class RefreshClaim {
  private constructor(readonly until: Date) {}

  static from(now: Date, leaseMs: number): RefreshClaim {
    return new RefreshClaim(new Date(now.getTime() + leaseMs));
  }

  static until(until: Date): RefreshClaim {
    return new RefreshClaim(until);
  }

  isActiveAt(now: Date): boolean {
    return this.until.getTime() > now.getTime();
  }

  equals(other: RefreshClaim): boolean {
    return this.until.getTime() === other.until.getTime();
  }
}
