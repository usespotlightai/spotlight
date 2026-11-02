export class VerifyUserEmailCommand {
  constructor(
    readonly token: string,
    readonly viewerId: string,
  ) {}
}
