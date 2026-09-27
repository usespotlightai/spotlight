export interface ApprovedMemory {
  readonly id: string;
  readonly body?: string;
}

export class ApproveMemoriesCommand {
  constructor(
    readonly teamId: string,
    readonly taskId: string,
    readonly runId: string,
    readonly memories: readonly ApprovedMemory[],
    readonly viewerId: string,
  ) {}
}
