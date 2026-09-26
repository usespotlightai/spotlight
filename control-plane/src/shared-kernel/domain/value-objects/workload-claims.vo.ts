export interface WorkloadClaims {
  readonly issuer: string;
  readonly subject: string;
  readonly audiences: readonly string[];
  readonly named: Readonly<Record<string, string>>;
}
