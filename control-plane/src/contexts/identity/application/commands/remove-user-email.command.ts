export class RemoveUserEmailCommand {
  constructor(
    readonly userEmailId: string,
    readonly viewerId: string,
  ) {}
}
