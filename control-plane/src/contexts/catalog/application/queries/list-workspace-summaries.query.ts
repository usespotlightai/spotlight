export class ListWorkspaceSummariesQuery {
  constructor(
    readonly after: string | null,
    readonly limit: number,
    readonly since: Date | null,
  ) {}
}
