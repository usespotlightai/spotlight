export class UnsuspendMemberCommand {
  constructor(
    readonly slug: string,
    readonly userId: string,
    readonly viewerId: string,
  ) {}
}
