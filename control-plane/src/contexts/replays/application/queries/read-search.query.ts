import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadSearchQuery {
  constructor(
    readonly teamId: string,
    readonly searchId: string,
    readonly principal: Principal,
  ) {}
}
