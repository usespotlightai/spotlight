export class SetPersonToolRuleCommand {
  constructor(
    readonly teamId: string,
    readonly source: string,
    readonly tool: string,
    readonly rule: string,
    readonly viewerId: string,
  ) {}
}
