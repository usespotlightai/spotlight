import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadLineQuery {
  constructor(
    readonly lineId: string,
    readonly principal: Principal,
  ) {}
}
