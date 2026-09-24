export class CreateSecretCommand {
  constructor(
    readonly workspaceId: string,
    readonly requesterId: string,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
