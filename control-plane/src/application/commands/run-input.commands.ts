import type { RunInput } from '@application/ports/run-input.port';

export class SendRunInputCommand {
  constructor(
    readonly runId: string,
    readonly viewerId: string,
    readonly input: RunInput,
  ) {}
}

export class AwaitRunInputCommand {
  constructor(
    readonly runId: string,
    readonly runnerId: string,
  ) {}
}

export class StopRunCommand {
  constructor(
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
