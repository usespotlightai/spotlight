export class SetPersonToolRuleCommand {
  constructor(
    readonly teamId: string,
    readonly integration: string,
    readonly tool: string,
    readonly rule: string,
    readonly viewerId: string,
  ) {}
}
