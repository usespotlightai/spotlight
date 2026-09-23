export class ImportIntegrationQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly viewerId: string,
  ) {}
}
