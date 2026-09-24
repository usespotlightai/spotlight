import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadWorkspaceQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
