import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadSearchRunQuery {
  constructor(
    readonly teamId: string,
    readonly runId: string,
    readonly principal: Principal,
  ) {}
}
