import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import { SkillDefinitionMovedOnError } from '@configuration/domain/exceptions/skill-definition-moved-on.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import { SkillKeyFixedError } from '@configuration/domain/exceptions/skill-key-fixed.error';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { SkillUses } from '@configuration/domain/value-objects/skill-uses.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = SkillDefinitionId.of('skill_1');

const read = (key = 'grafana', body = 'Search first.') => ({
  skill: Skill.defined({
    key: SkillKey.of(key),
    description: 'Look up dashboards',
    instructions: body,
  }),
  files: SkillFiles.of({ 'SKILL.md': body }),
});

const kept = (version = 3) =>
  SkillDefinition.rehydrate({
    id: ID,
    teamId: TEAM,
    key: SkillKey.of('grafana'),
    files: SkillFiles.of({ 'SKILL.md': 'Search first.' }),
    version,
  });

const GIVEN = SkillUses.of([
  { skill: 'grafana', by: 'delivery/implementation' },
]);

describe('SkillDefinition', () => {
  it('is defined for a team under its skill’s key, and says so', () => {
    const defined = SkillDefinition.define({ ...read(), id: ID, teamId: TEAM });

    expect(defined.key.value).toBe('grafana');
    expect(defined.isNew).toBe(true);
    expect(defined.pullEvents()).toEqual([
      new SkillDefined(ID, TEAM, SkillKey.of('grafana')),
    ]);
  });

  it('refuses a change made against another version', () => {
    expect(() => kept(3).expecting(2)).toThrow(SkillDefinitionMovedOnError);
  });

  it('takes new files, and says so', () => {
    const redefined = kept().redefinedAs(read('grafana', 'Search twice.'));

    expect(redefined.files.fields).toEqual({ 'SKILL.md': 'Search twice.' });
    expect(redefined.pullEvents()).toEqual([
      new SkillRedefined(ID, TEAM, SkillKey.of('grafana')),
    ]);
  });

  it('keeps its key for its whole life', () => {
    expect(() => kept().redefinedAs(read('loki'))).toThrow(SkillKeyFixedError);
  });

  it('will not retire while a station gives it', () => {
    expect(() => kept().retired(GIVEN)).toThrow(SkillInUseError);
    expect(() => kept().retired(GIVEN)).toThrow(/delivery\/implementation/);
  });

  it('retires when no station gives it, and cannot change after', () => {
    const retired = kept().retired(
      SkillUses.of([{ skill: 'loki', by: 'delivery/implementation' }]),
    );

    expect(retired.isRetired).toBe(true);
    expect(retired.pullEvents()).toEqual([
      new SkillRetired(ID, TEAM, SkillKey.of('grafana')),
    ]);
    expect(() => retired.redefinedAs(read())).toThrow(InconsistentStateError);
  });

  it('is abandoned with its team, whoever still gives it', () => {
    const abandoned = kept().abandoned();

    expect(abandoned.isRetired).toBe(true);
    expect(abandoned.pullEvents()).toEqual([
      new SkillRetired(ID, TEAM, SkillKey.of('grafana')),
    ]);
  });
});
