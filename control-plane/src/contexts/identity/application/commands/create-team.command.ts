export class CreateTeamCommand {
  constructor(
    readonly workspaceId: string,
    readonly requesterId: string,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
