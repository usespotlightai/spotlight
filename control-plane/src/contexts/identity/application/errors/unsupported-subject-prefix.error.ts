export class UnsupportedSubjectPrefixError extends Error {
  readonly kind = 'invalid' as const;

  constructor(prefix: string) {
    super(
      `GitHub gives the OIDC tokens of this repository the subject prefix ${prefix}. An OIDC trust from setup can match only repo:owner/name or repo:owner@id/name@id. Use one of these subject forms in the repository’s OIDC settings, then set up again.`,
    );
    this.name = 'UnsupportedSubjectPrefixError';
  }
}
