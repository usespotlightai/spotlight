import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';

export interface SentHostCallResponse {
  readonly host: unknown;
  readonly status: unknown;
  readonly headers: unknown;
  readonly body: unknown;
  readonly ms: unknown;
  readonly error: unknown;
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
    readonly host: unknown,
    readonly token: unknown,
    readonly recipient: unknown,
  ) {}
}
