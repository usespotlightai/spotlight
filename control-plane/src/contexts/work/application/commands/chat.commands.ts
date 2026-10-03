export class StartChatCommand {
  constructor(
    readonly teamId: string,
    readonly startedBy: string,
    readonly harness: string,
    readonly model: string | null,
    readonly effort: string | null,
    readonly repositories: readonly string[],
    readonly body: string,
    readonly attachments: readonly string[] = [],
    readonly traces: readonly string[] = [],
    readonly improving: string | null = null,
  ) {}
}

export class SayInChatCommand {
  constructor(
    readonly teamId: string,
    readonly chatId: string,
    readonly saidBy: string,
    readonly body: string,
    readonly attachments: readonly string[] = [],
    readonly traces: readonly string[] = [],
    readonly model?: string | null,
    readonly effort?: string | null,
  ) {}
}

export class StopChatCommand {
  constructor(
    readonly teamId: string,
    readonly chatId: string,
    readonly stoppedBy: string,
  ) {}
}

export class AcceptProposalCommand {
  constructor(
    readonly teamId: string,
    readonly chatId: string,
    readonly position: number,
    readonly acceptedBy: string,
  ) {}
}

export class DismissProposalCommand {
  constructor(
    readonly teamId: string,
    readonly chatId: string,
    readonly position: number,
    readonly dismissedBy: string,
  ) {}
}
