export class CreateLineCommand {
  constructor(
    readonly teamId: string,
    readonly requesterId: string,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
