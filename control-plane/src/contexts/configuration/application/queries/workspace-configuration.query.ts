import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class WorkspaceConfigurationQuery {
  constructor(
    readonly workspaceId: string,
    readonly principal: Principal,
  ) {}
}
