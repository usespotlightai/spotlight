export interface StationConfigShape {
  readonly prompt: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profile: { readonly key: string; readonly settings: unknown } | null;
  readonly image: string | null;
  readonly repositories: readonly {
    readonly name: string;
    readonly setup: string | null;
  }[];
  readonly skills: readonly { readonly key: string; readonly hash: string }[];
  readonly tools: readonly string[];
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly judge?: {
    readonly rubricHash: string;
    readonly sample: number;
    readonly minAgreement: number;
  };
}

export interface ConfigChangeShape {
  readonly part: string;
  readonly name: string | null;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly was: string | null;
  readonly now: string | null;
}

export interface FingerprintedConfig {
  readonly fingerprint: string;
  readonly config: StationConfigShape;
  readonly changes: readonly ConfigChangeShape[];
}
