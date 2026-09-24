export class ImportSecretQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly viewerId: string,
  ) {}
}
