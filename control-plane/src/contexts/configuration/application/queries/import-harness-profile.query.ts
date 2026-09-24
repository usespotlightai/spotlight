import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ImportHarnessProfileQuery {
  constructor(
    readonly workspaceId: string,
    readonly address: string,
    readonly principal: Principal,
  ) {}
}
