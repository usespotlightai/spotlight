import type { HostCredential } from '@runners/application/ports/runner-admissions.port';

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
    readonly credential: HostCredential,
    readonly host: string,
  ) {}
}

export class AnswerHostCallCommand {
  constructor(
    readonly credential: HostCredential,
    readonly callId: string,
    readonly answer: SentHostCallAnswer,
  ) {}
}
