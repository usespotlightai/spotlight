import {
  HANDING_OVER,
  USING_TOOLS,
} from '@shared-kernel/domain/built-in-skills';
import { distinct } from '@shared-kernel/domain/distinct';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { builtInTool } from '@work/domain/value-objects/built-in-tools';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import type { RefusalReason } from '@work/domain/value-objects/refusal-reason';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface EnabledForRun {
  readonly stationTools: readonly Tool[];
  readonly toolsOnMarks: readonly Tool[];
  readonly tools: readonly Tool[];
  readonly builtInSkills: readonly SkillKey[];
  readonly teamSkills: readonly ReadySkill[];
  readonly pinned: readonly Tool[];
  readonly profile: ReadyProfile | null;
  readonly refusals: readonly RefusalReason[];
}

const profileAt = (
  station: Station,
  profiles: readonly ReadyProfile[],
): Pick<EnabledForRun, 'profile' | 'refusals'> => {
  const named = station.profile;

  if (!named) {
    return { profile: null, refusals: [] };
  }

  const profile = profiles.find((each) => each.key.equals(named)) ?? null;

  return {
    profile,
    refusals: profile ? [] : [ProfileMissing.at(station.name, named)],
  };
};

export const enabledAt = (
  station: Station,
  ready: readonly ReadySkill[],
  profiles: readonly ReadyProfile[],
  onMarks: readonly Tool[] = [],
): EnabledForRun => {
  const teamSkills = station.skills.flatMap((key) =>
    ready.filter((skill) => skill.key.equals(key)),
  );
  const stationTools = distinct([
    ...station.tools,
    ...teamSkills.flatMap((skill) => skill.tools),
  ]);
  const toolsOnMarks = distinct(onMarks).filter(
    (each) => !stationTools.some((tool) => tool.equals(each)),
  );
  const tools = [...stationTools, ...toolsOnMarks];
  const builtInSkills = distinct([
    HANDING_OVER,
    ...tools.flatMap((tool) => {
      const skill = builtInTool(tool)?.skill;
      return skill ? [skill] : [];
    }),
  ]);

  const pinned = stationTools.filter((each) => each.origin === 'catalog');

  return {
    stationTools,
    toolsOnMarks,
    tools,
    builtInSkills,
    teamSkills,
    pinned,
    ...profileAt(station, profiles),
  };
};

export const describedTools = (
  tools: readonly Tool[],
  provided: readonly DeclaredTool[],
): DeclaredTool[] =>
  tools.flatMap((tool) => {
    const found =
      builtInTool(tool)?.declared ??
      provided.find((each) => each.tool.equals(tool));

    return found ? [found] : [];
  });

export const skillsForTools = (
  described: readonly DeclaredTool[],
): SkillKey[] =>
  described.some((each) => each.tool.origin !== 'built-in')
    ? [USING_TOOLS]
    : [];
