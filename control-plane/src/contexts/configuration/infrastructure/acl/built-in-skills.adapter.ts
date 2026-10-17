import type { BuiltInSkillsPort } from '@configuration/application/ports/built-in-skills.port';
import { ReadySkillMapper } from '@configuration/infrastructure/acl/ready-skill.mapper';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { BuiltInSkillsPort as WorkBuiltInSkillsPort } from '@work/application/ports/built-in-skills.port';

export class BuiltInSkills implements WorkBuiltInSkillsPort {
  constructor(private readonly builtIn: BuiltInSkillsPort) {}

  named(key: string): ReadySkillFolder | null {
    const found = this.builtIn.named(key);

    return found ? ReadySkillMapper.toReady(found) : null;
  }
}
