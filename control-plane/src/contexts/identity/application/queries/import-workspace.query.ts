import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ImportWorkspaceQuery {
  constructor(
    readonly address: string,
    readonly principal: Principal,
  ) {}
}
