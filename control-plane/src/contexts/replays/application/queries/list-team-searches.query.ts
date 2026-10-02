import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListTeamSearchesQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly page: { readonly before: string | null; readonly limit: number },
  ) {}
}
