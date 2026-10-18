export interface EgressConnectionRecord {
  readonly proxyCredential: string;
  readonly host: string;
  readonly port: number;
  readonly bytesOut: number;
  readonly bytesIn: number;
  readonly ms: number;
  readonly outcome: string;
  readonly status?: number;
  readonly reason?: string;
  readonly at: string;
}

export type EgressConnectionsRecordedDto =
  | { readonly outcome: 'unauthorized' }
  | { readonly outcome: 'too-many'; readonly max: number }
  | {
      readonly outcome: 'recorded';
      readonly recorded: number;
      readonly dropped: number;
    };
