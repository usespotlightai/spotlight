export class SetSecretCommand {
  constructor(
    readonly teamId: string,
    readonly name: string,
    /** Never logged, never answered with, and never leaves this process. */
    readonly value: string,
    readonly viewerId: string,
  ) {}
}
