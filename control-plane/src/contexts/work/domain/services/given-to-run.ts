import { distinct } from '@shared-kernel/domain/services/distinct';
import type { Station } from '@work/domain/entities/station.entity';
import { HANDING_OVER } from '@work/domain/services/built-in-skills';
import { builtInTool } from '@work/domain/services/built-in-tools';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export interface GivenToRun {
  readonly tools: readonly Tool[];
  readonly builtInSkills: readonly SkillKey[];
  readonly teamSkills: readonly ReadySkill[];
}

export const givenAt = (
  station: Station,
  ready: readonly ReadySkill[],
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
