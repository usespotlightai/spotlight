import type { Skill } from '@configuration/domain/entities/skill.entity';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export interface GivingStation {
  readonly path: string;
  readonly tools: readonly ToolName[];
  readonly skills: readonly SkillKey[];
}

export type BuiltIn = (tool: ToolName) => boolean;

export interface SecretMissing {
  readonly skill: SkillKey;
  readonly secret: SecretName;
}

export interface SecretWritten {
  readonly skill: SkillKey;
}

export interface SkillToolUnoffered {
  readonly skill: SkillKey;
  readonly tool: ToolName;
  readonly at: number;
}

export interface StationToolUnoffered {
  readonly path: string;
  readonly tool: ToolName;
  readonly at: number;
}

export interface StationSkillUndefined {
  readonly path: string;
  readonly skill: SkillKey;
  readonly at: number;
}

const SECRET_REFERENCE = /\$\{\{\s*secrets?\./;

const offers = (
  offered: readonly ToolName[],
  builtIn: BuiltIn,
  tool: ToolName,
): boolean => builtIn(tool) || offered.some((each) => each.equals(tool));

export const secretsMissing = (
  skills: readonly Skill[],
  held: readonly SecretName[],
): SecretMissing[] =>
  skills.flatMap((skill) =>
    skill
      .missingFrom(held)
      .map((needed) => ({ skill: skill.key, secret: needed.name })),
  );

export const secretsWrittenIn = (
  skills: readonly {
    readonly skill: SkillKey;
    readonly texts: readonly string[];
  }[],
): SecretWritten[] =>
  skills
    .filter((each) => each.texts.some((text) => SECRET_REFERENCE.test(text)))
    .map((each) => ({ skill: each.skill }));

export const skillToolsUnoffered = (
  skills: readonly Skill[],
  offered: readonly ToolName[],
  builtIn: BuiltIn,
): SkillToolUnoffered[] =>
  skills.flatMap((skill) =>
    skill.tools.flatMap((tool, at) =>
      offers(offered, builtIn, tool) ? [] : [{ skill: skill.key, tool, at }],
    ),
  );

export const stationToolsUnoffered = (
  stations: readonly GivingStation[],
  offered: readonly ToolName[],
  builtIn: BuiltIn,
): StationToolUnoffered[] =>
  stations.flatMap((station) =>
    station.tools.flatMap((tool, at) =>
      offers(offered, builtIn, tool) ? [] : [{ path: station.path, tool, at }],
    ),
  );

export const stationSkillsUndefined = (
  stations: readonly GivingStation[],
  defined: readonly Skill[],
): StationSkillUndefined[] =>
  stations.flatMap((station) =>
    station.skills.flatMap((skill, at) =>
      defined.some((each) => each.key.equals(skill))
        ? []
        : [{ path: station.path, skill, at }],
    ),
  );
