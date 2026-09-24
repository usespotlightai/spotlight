export class DeleteSecretCommand {
  constructor(
    readonly secretId: string,
    readonly requesterId: string,
    readonly expectedVersion: number,
  ) {}
}
