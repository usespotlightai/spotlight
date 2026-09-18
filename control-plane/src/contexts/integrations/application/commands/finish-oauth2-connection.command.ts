export class FinishOAuth2ConnectionCommand {
  constructor(
    readonly state: string,
    readonly code: string,
    readonly nonce: string | null,
    readonly viewerId: string | null,
  ) {}
}
