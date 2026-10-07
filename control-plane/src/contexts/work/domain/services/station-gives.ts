import { repeatedIn } from '@shared-kernel/domain/services/distinct';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export const skillsRefused = (skills: readonly SkillKey[]): string | null => {
  const own = skills.find((each) => each.isSpotlights);

  if (own) {
    return `cannot name skill ${own.value}. Spotlight already gives it where it applies`;
  }

  const twice = repeatedIn(skills.map((each) => each.unversioned));

  return twice ? `names skill ${twice} twice` : null;
};

export const toolsRefused = (tools: readonly Tool[]): string | null => {
  const twice = repeatedIn(tools.map((each) => each.called));

  return twice ? `names tool ${twice} twice` : null;
};
