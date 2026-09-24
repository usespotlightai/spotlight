import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadSkillQuery {
  constructor(
    readonly skillId: string,
    readonly principal: Principal,
  ) {}
}
