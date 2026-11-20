import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListWorkspaceSecretsQuery {
  constructor(
    readonly slug: string,
    readonly principal: Principal,
  ) {}
}
