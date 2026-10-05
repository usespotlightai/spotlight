import { distinct } from '@shared-kernel/domain/services/distinct';
import type { Station } from '@work/domain/entities/station.entity';
import {
  HANDING_OVER,
  USING_TOOLS,
} from '@work/domain/services/built-in-skills';
import { builtInTool } from '@work/domain/services/built-in-tools';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { ProfileMissing } from '@work/domain/value-objects/profile-missing.vo';
import type { ReadyProfile } from '@work/domain/value-objects/ready-profile';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import type { RefusalReason } from '@work/domain/value-objects/run-outcome.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

export interface GivenToRun {
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
): Pick<GivenToRun, 'profile' | 'refusals'> => {
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

export const givenAt = (
  station: Station,
  ready: readonly ReadySkill[],
  profiles: readonly ReadyProfile[],
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

  const pinned = tools.filter((each) => each.origin === 'catalog');

  return {
    tools,
    builtInSkills,
    teamSkills,
    pinned,
    ...profileAt(station, profiles),
  };
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

export const skillsForTools = (
  described: readonly DeclaredTool[],
): SkillKey[] =>
  described.some((each) => each.tool.origin !== 'built-in')
    ? [USING_TOOLS]
    : [];
