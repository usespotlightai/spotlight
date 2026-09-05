export class ForgetSecretCommand {
  constructor(
    readonly teamId: string,
    readonly name: string,
    readonly viewerId: string,
  ) {}
}
