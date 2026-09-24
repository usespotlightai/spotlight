import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadHarnessProfileQuery {
  constructor(
    readonly profileId: string,
    readonly principal: Principal,
  ) {}
}
