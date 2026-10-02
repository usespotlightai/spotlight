export class InvalidStationAddressError extends Error {
  readonly violation = 'invalid' as const;

  constructor(held: string) {
    super(
      `A station is named by its team, line and station keys, as in core/delivery/build, not ${held}`,
    );
    this.name = 'InvalidStationAddressError';
  }
}
