import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';

export interface SentHostCallResponse {
  readonly host: string;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly ms: number;
  readonly error: string | null;
}

export class ClaimHostCallCommand {
  constructor(
    readonly credential: HostCredentials,
    readonly host: string,
  ) {}
}

export class RecordHostCallResponseCommand {
  constructor(
    readonly credential: HostCredentials,
    readonly callId: string,
    readonly response: SentHostCallResponse,
  ) {}
}

export class RedeemCallSecretsCommand {
  constructor(
    readonly callId: string,
    readonly host: string,
    readonly token: string,
    readonly recipient: string,
  ) {}
}
