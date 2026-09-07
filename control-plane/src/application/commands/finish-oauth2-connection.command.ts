export class FinishOAuth2ConnectionCommand {
  constructor(
    readonly state: string,
    readonly code: string,
  ) {}
}
