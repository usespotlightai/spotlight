import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadHookQuery {
  constructor(
    readonly hookId: string,
    readonly principal: Principal,
  ) {}
}
