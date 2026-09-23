export class CreateWorkspaceCommand {
  constructor(
    readonly requesterId: string,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
