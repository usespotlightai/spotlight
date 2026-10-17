import type { HostCredentials } from '@runners/application/ports/runner-authenticator.port';

export interface SentHostCallAnswer {
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

export class AnswerHostCallCommand {
  constructor(
    readonly credential: HostCredentials,
    readonly callId: string,
    readonly answer: SentHostCallAnswer,
  ) {}
}
