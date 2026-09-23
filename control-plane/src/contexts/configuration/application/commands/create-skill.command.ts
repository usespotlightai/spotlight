export class CreateSkillCommand {
  constructor(
    readonly teamId: string,
    readonly requesterId: string,
    readonly idempotencyKey: string,
    readonly definition: unknown,
  ) {}
}
