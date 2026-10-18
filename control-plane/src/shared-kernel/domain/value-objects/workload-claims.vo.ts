export interface WorkloadClaims {
  readonly issuer: string;
  readonly subject: string;
  readonly audiences: readonly string[];
  readonly customClaims: Readonly<Record<string, string>>;
}
