import { repeatedIn } from '@domain/services/distinct';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

export const skillsRefused = (skills: readonly SkillKey[]): string | null => {
  const own = skills.find((each) => each.isSpotlights);

  if (own) {
    return `names ${own.value}, which is Spotlight’s own and given wherever it applies: take it away`;
  }

  const twice = repeatedIn(skills);

  return twice ? `names the skill ${twice.value} twice: name it once` : null;
};

export const toolsRefused = (tools: readonly Tool[]): string | null => {
  const twice = repeatedIn(tools);

  return twice ? `names the tool ${twice.value} twice: name it once` : null;
};
