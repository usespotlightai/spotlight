export interface RunRedemption {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly wears: readonly string[];
  readonly recipient: string;
  readonly sharedEgress: string | null;
}

interface ReadInNetwork {
  readonly kind: 'aws-secrets-manager';
  readonly secretId: string;
  readonly field: string | null;
}

export interface RedeemedSecret {
  readonly secret: string;
  readonly host: string;
  readonly carrier: string;
  readonly name: string;
  readonly prefix: string;
  readonly sealed: string | null;
  readonly readInNetwork: ReadInNetwork | null;
}

export interface WithheldSecret {
  readonly secret: string;
  readonly reason: string;
}

export interface Redeemed {
  readonly secrets: readonly RedeemedSecret[];
  readonly withheld: readonly WithheldSecret[];
}
