export class ImportSkillQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly viewerId: string,
  ) {}
}
