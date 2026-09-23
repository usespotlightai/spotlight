export class ImportIntegrationQuery {
  constructor(
    readonly slug: string,
    readonly address: string,
    readonly viewerId: string,
  ) {}
}
