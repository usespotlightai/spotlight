export class ChooseIntegrationsCommand {
  constructor(
    readonly teamId: string,
    readonly sources: readonly string[],
    readonly viewerId: string,
    readonly dropped: readonly string[] = [],
    readonly secrets: Readonly<Record<string, string>> = {},
  ) {}
}
