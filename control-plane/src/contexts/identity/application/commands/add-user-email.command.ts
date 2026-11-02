export class AddUserEmailCommand {
  constructor(
    readonly email: string,
    readonly viewerId: string,
    readonly viewerEmail: string,
  ) {}
}
