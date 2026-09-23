export class ImportLineQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly viewerId: string,
  ) {}
}
