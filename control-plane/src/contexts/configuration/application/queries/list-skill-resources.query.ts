import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListSkillResourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
