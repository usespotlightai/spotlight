export class ListMergedDecisionsQuery {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    readonly repository: string | null,
    readonly paths: readonly string[],
    readonly since: string | null,
    readonly until: string | null,
  ) {}
}
