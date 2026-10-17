export class EgressTokenTakenError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'token';

  readonly because =
    'belongs to another egress. Please give each egress its own';

  constructor() {
    super(
      'Egress token belongs to another egress. Please give each egress its own.',
    );
    this.name = 'EgressTokenTakenError';
  }
}
