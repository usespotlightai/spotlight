import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListCandidatesQuery {
  constructor(
    readonly workspaceId: string,
    readonly station: string | null,
    readonly principal: Principal,
  ) {}
}
