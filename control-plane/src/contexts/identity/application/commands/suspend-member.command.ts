export class SuspendMemberCommand {
  constructor(
    readonly slug: string,
    readonly userId: string,
    readonly viewerId: string,
  ) {}
}
