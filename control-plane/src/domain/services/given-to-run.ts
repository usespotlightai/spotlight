import type { DeclaredTool } from '@domain/entities/declared-tool.entity';
import type { Skill } from '@domain/entities/skill.entity';
import type { Station } from '@domain/entities/station.entity';
import { HANDING_OVER } from '@domain/services/built-in-skills';
import { builtInTool } from '@domain/services/built-in-tools';
import { distinct } from '@domain/services/distinct';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

export interface GivenToRun {
  readonly tools: readonly Tool[];
  readonly builtInSkills: readonly SkillKey[];
  readonly teamSkills: readonly Skill[];
}

export const givenAt = (
  station: Station,
  ready: readonly Skill[],
): GivenToRun => {
  const teamSkills = station.skills.flatMap((key) =>
    ready.filter((skill) => skill.key.equals(key)),
  );
  const tools = distinct([
    ...station.tools,
    ...teamSkills.flatMap((skill) => skill.tools),
  ]);
  const builtInSkills = distinct([
    HANDING_OVER,
    ...tools.flatMap((tool) => {
      const skill = builtInTool(tool)?.skill;
      return skill ? [skill] : [];
    }),
  ]);

  return { tools, builtInSkills, teamSkills };
};

export const describedTools = (
  tools: readonly Tool[],
  offered: readonly DeclaredTool[],
): DeclaredTool[] =>
  tools.flatMap((tool) => {
    const found =
      builtInTool(tool)?.declared ??
      offered.find((each) => each.tool.equals(tool));

    return found ? [found] : [];
  });
