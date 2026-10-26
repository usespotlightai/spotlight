export class TrustKeyTakenError extends Error {
  readonly kind = 'conflict' as const;

  constructor(key: string, subject: string) {
    super(
      `The OIDC trust ${key} already admits another workload (${subject}). Rename or delete that trust, then set up again.`,
    );
    this.name = 'TrustKeyTakenError';
  }
}
