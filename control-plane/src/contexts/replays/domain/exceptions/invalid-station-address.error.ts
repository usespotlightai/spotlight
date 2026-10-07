export class InvalidStationAddressError extends Error {
  readonly violation = 'invalid' as const;

  constructor(held: string) {
    super(
      `Station address must be team, line and station keys, as in core/delivery/build. Received: ${held}`,
    );
    this.name = 'InvalidStationAddressError';
  }
}
