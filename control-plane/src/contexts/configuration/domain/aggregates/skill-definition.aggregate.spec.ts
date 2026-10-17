import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillCreated } from '@configuration/domain/events/skill-created.event';
import { SkillDeleted } from '@configuration/domain/events/skill-deleted.event';
import { SkillUpdated } from '@configuration/domain/events/skill-updated.event';
import { SkillDefinitionVersionConflictError } from '@configuration/domain/exceptions/skill-definition-version-conflict.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = SkillDefinitionId.of('skill_1');

const parsed = (key = 'grafana', body = 'Search first.') => ({
  skill: Skill.define({
    key: SkillKey.of(key),
    description: 'Look up dashboards',
    instructions: body,
    secrets: [],
    tools: [],
  }),
  files: SkillFiles.of({ 'SKILL.md': body }),
});

const stored = (version = 3) =>
  SkillDefinition.rehydrate({
    id: ID,
    teamId: TEAM,
    key: SkillKey.of('grafana'),
    files: SkillFiles.of({ 'SKILL.md': 'Search first.' }),
    version,
  });

const BY = attributedIn();

const GRAFANA = { resource: 'skill' as const, id: 'skill_1', key: 'grafana' };

const ENABLED = StationUses.of([
  { name: 'grafana', by: 'delivery/implementation' },
]);

describe('SkillDefinition', () => {
  it('is created for a team under its skill’s key, and says so', () => {
    const created = SkillDefinition.create({
      ...parsed(),
      id: ID,
      teamId: TEAM,
      by: BY,
    });

    expect(created.key.value).toBe('grafana');
    expect(created.isNew).toBe(true);
    expect(created.pullEvents()).toEqual([
      new SkillCreated(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.created(GRAFANA, BY),
      ),
    ]);
  });

  it('rejects a change made against another version', () => {
    expect(() => stored(3).assertVersion(2)).toThrow(
      SkillDefinitionVersionConflictError,
    );
  });

  it('takes new files, and says so', () => {
    const updated = stored().update(parsed('grafana', 'Search twice.'), BY);

    expect(updated.files.fields).toEqual({ 'SKILL.md': 'Search twice.' });
    expect(updated.pullEvents()).toEqual([
      new SkillUpdated(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.updated(GRAFANA, BY),
      ),
    ]);
  });

  it('keeps its key for its whole life', () => {
    expect(() => stored().update(parsed('loki'), BY)).toThrow(
      ImmutableFieldError,
    );
  });

  it('will not be deleted while a station enables it', () => {
    expect(() => stored().delete(ENABLED, BY)).toThrow(SkillInUseError);
    expect(() => stored().delete(ENABLED, BY)).toThrow(
      /delivery\/implementation/,
    );
  });

  it('is deleted when no station enables it, and cannot change after', () => {
    const deleted = stored().delete(
      StationUses.of([{ name: 'loki', by: 'delivery/implementation' }]),
      BY,
    );

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new SkillDeleted(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.deleted(GRAFANA, BY),
      ),
    ]);
    expect(() => deleted.update(parsed(), BY)).toThrow(InconsistentStateError);
  });

  it('is deleted with its team, whichever station still enables it', () => {
    const deleted = stored().cascadeDelete(BY);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new SkillDeleted(
        ID,
        TEAM,
        SkillKey.of('grafana'),
        ConfigurationChange.deleted(GRAFANA, BY),
      ),
    ]);
  });
});
