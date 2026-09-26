export class RedeemEgressCommand {
  constructor(
    readonly token: string | undefined,
    readonly recipient: string,
  ) {}
}
