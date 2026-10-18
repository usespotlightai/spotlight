export class InvalidStationPathError extends Error {
  readonly kind = 'invalid' as const;

  constructor(raw: string) {
    super(
      `Station path must be team, line and station keys, as in core/delivery/build. Received: ${raw}`,
    );
    this.name = 'InvalidStationPathError';
  }
}
