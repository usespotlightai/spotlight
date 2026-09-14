import type { Skill } from '@domain/entities/skill.entity';
import { builtInTool } from '@domain/services/built-in-tools';
import type { LineKey } from '@domain/value-objects/line-key.vo';
import type { LinePlan } from '@domain/value-objects/line-plan.vo';
import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

export interface SecretMissing {
  readonly skill: SkillKey;
  readonly secret: SecretName;
}

export interface SecretWritten {
  readonly skill: SkillKey;
}

export interface SkillToolUnoffered {
  readonly skill: SkillKey;
  readonly tool: Tool;
  readonly at: number;
}

export interface StationToolUnoffered {
  readonly line: LineKey;
  readonly station: number;
  readonly tool: Tool;
  readonly at: number;
}

export interface StationSkillUndefined {
  readonly line: LineKey;
  readonly station: number;
  readonly skill: SkillKey;
  readonly at: number;
}

const SECRET_REFERENCE = /\$\{\{\s*secrets?\./;

const offers = (offered: readonly Tool[], tool: Tool): boolean =>
  builtInTool(tool) !== null || offered.some((each) => each.equals(tool));

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
  offered: readonly Tool[],
): SkillToolUnoffered[] =>
  skills.flatMap((skill) =>
    skill.tools.flatMap((tool, at) =>
      offers(offered, tool) ? [] : [{ skill: skill.key, tool, at }],
    ),
  );

export const stationToolsUnoffered = (
  plans: readonly LinePlan[],
  offered: readonly Tool[],
): StationToolUnoffered[] =>
  plans.flatMap((plan) =>
    plan.stations.flatMap((station, index) =>
      station.tools.flatMap((tool, at) =>
        offers(offered, tool)
          ? []
          : [{ line: plan.key, station: index, tool, at }],
      ),
    ),
  );

export const stationSkillsUndefined = (
  plans: readonly LinePlan[],
  defined: readonly Skill[],
): StationSkillUndefined[] =>
  plans.flatMap((plan) =>
    plan.stations.flatMap((station, index) =>
      station.skills.flatMap((skill, at) =>
        defined.some((each) => each.key.equals(skill))
          ? []
          : [{ line: plan.key, station: index, skill, at }],
      ),
    ),
  );
