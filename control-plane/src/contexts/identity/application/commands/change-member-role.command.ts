export class ChangeMemberRoleCommand {
  constructor(
    readonly slug: string,
    readonly userId: string,
    readonly role: string,
    readonly viewerId: string,
  ) {}
}
