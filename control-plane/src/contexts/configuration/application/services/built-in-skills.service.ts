import { ReadySkillMapper } from '@configuration/application/mappers/ready-skill.mapper';
import type { ShippedSkillsPort } from '@configuration/application/ports/shipped-skills.port';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { BuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';

export class BuiltInSkills implements BuiltInSkillsPort {
  constructor(private readonly shipped: ShippedSkillsPort) {}

  named(key: string): ReadySkillFolder | null {
    const found = this.shipped.named(key);

    return found ? ReadySkillMapper.toReady(found) : null;
  }
}
