export interface RunSecretFetch {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly injectedSecrets: readonly string[];
  readonly recipient: string;
  readonly sharedEgress: string | null;
}

interface ExternalSecretRef {
  readonly kind: 'aws-secrets-manager';
  readonly secretId: string;
  readonly field: string | null;
}

export interface FetchedSecret {
  readonly secret: string;
  readonly host: string;
  readonly location: string;
  readonly name: string;
  readonly prefix: string;
  readonly sealed: string | null;
  readonly externalRef: ExternalSecretRef | null;
}

export interface DeniedSecret {
  readonly secret: string;
  readonly reason: string;
}

export interface FetchedSecrets {
  readonly secrets: readonly FetchedSecret[];
  readonly denied: readonly DeniedSecret[];
}
