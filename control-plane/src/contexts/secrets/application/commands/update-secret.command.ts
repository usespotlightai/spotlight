export class UpdateSecretCommand {
  constructor(
    readonly secretId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
    readonly definition: unknown,
  ) {}
}
