export class ResendUserEmailVerificationCommand {
  constructor(
    readonly userEmailId: string,
    readonly viewerId: string,
    readonly viewerEmail: string,
  ) {}
}
