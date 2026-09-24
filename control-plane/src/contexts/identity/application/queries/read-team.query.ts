import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadTeamQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
  ) {}
}
