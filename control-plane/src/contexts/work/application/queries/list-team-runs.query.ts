import type { PageRequest } from '@shared-kernel/application/dto/page.dto';

export class ListTeamRunsQuery {
  constructor(
    readonly teamId: string,
    readonly viewerId: string,
    readonly page: PageRequest,
  ) {}
}

export class ReadTeamRunQuery {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly viewerId: string,
  ) {}
}
