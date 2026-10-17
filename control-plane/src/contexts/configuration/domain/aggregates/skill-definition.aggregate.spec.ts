import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import { SkillDefinitionVersionConflictError } from '@configuration/domain/exceptions/skill-definition-version-conflict.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import { SkillKeyFixedError } from '@configuration/domain/exceptions/skill-key-fixed.error';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = SkillDefinitionId.of('skill_1');

const read = (key = 'grafana', body = 'Search first.') => ({
  skill: Skill.define({
    key: SkillKey.of(key),
    description: 'Look up dashboards',
    instructions: body,
    secrets: [],
    tools: [],
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

const BY = attributedIn();

const GRAFANA = { resource: 'skill' as const, id: 'skill_1', key: 'grafana' };

const GIVEN = StationUses.of([
  { name: 'grafana', by: 'delivery/implementation' },
]);

describe('SkillDefinition', () => {
  it('is defined for a team under its skill’s key, and says so', () => {
    const defined = SkillDefinition.define({
      ...read(),
      id: ID,
      teamId: TEAM,
      by: BY,
    });

    expect(defined.key.value).toBe('grafana');
    expect(defined.isNew).toBe(true);
    expect(defined.pullEvents()).toEqual([
      new SkillDefined(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.created(GRAFANA, BY),
      ),
    ]);
  });

  it('rejects a change made against another version', () => {
    expect(() => kept(3).assertVersion(2)).toThrow(
      SkillDefinitionVersionConflictError,
    );
  });

  it('takes new files, and says so', () => {
    const redefined = kept().redefinedAs(read('grafana', 'Search twice.'), BY);

    expect(redefined.files.fields).toEqual({ 'SKILL.md': 'Search twice.' });
    expect(redefined.pullEvents()).toEqual([
      new SkillRedefined(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.updated(GRAFANA, BY),
      ),
    ]);
  });

  it('keeps its key for its whole life', () => {
    expect(() => kept().redefinedAs(read('loki'), BY)).toThrow(
      SkillKeyFixedError,
    );
  });

  it('will not retire while a station gives it', () => {
    expect(() => kept().retire(GIVEN, BY)).toThrow(SkillInUseError);
    expect(() => kept().retire(GIVEN, BY)).toThrow(/delivery\/implementation/);
  });

  it('retires when no station gives it, and cannot change after', () => {
    const retired = kept().retire(
      StationUses.of([{ name: 'loki', by: 'delivery/implementation' }]),
      BY,
    );

    expect(retired.isRetired).toBe(true);
    expect(retired.pullEvents()).toEqual([
      new SkillRetired(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.deleted(GRAFANA, BY),
      ),
    ]);
    expect(() => retired.redefinedAs(read(), BY)).toThrow(
      InconsistentStateError,
    );
  });

  it('is abandoned with its team, whoever still gives it', () => {
    const abandoned = kept().abandon(BY);

    expect(abandoned.isRetired).toBe(true);
    expect(abandoned.pullEvents()).toEqual([
      new SkillRetired(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.deleted(GRAFANA, BY),
      ),
    ]);
  });
});
