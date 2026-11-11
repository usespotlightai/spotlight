import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { SkillCreated } from '@configuration/domain/events/skill-created.event';
import { SkillDeleted } from '@configuration/domain/events/skill-deleted.event';
import { SkillUpdated } from '@configuration/domain/events/skill-updated.event';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillDefinitionVersionConflictError } from '@configuration/domain/exceptions/skill-definition-version-conflict.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import type { SkillFolderReading } from '@configuration/domain/services/skill-folder-reading';
import { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { Skill } from '@configuration/domain/value-objects/skill.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = SkillDefinitionId.of('skill_1');

const parsed = (key = 'grafana', body = 'Search first.') => ({
  key: DefinedSkillKey.of(key),
  files: SkillFiles.of({ 'SKILL.md': body }),
});

const READING: SkillFolderReading = {
  skillIn: (key, files) =>
    Skill.define({
      key,
      description: 'Look up dashboards',
      instructions: files.fields['SKILL.md'] ?? '',
      secrets: [],
      tools: [],
    }),
};

const stored = (version = 3) =>
  SkillDefinition.rehydrate({
    id: ID,
    teamId: TEAM,
    key: DefinedSkillKey.of('grafana'),
    files: SkillFiles.of({ 'SKILL.md': 'Search first.' }),
    version,
  });

const BY = changeActorIn();

const GRAFANA = { resource: 'skill' as const, id: 'skill_1', key: 'grafana' };

const ENABLED = StationUses.of([
  {
    used: SkillKey.of('grafana'),
    line: LineKey.of('delivery'),
    station: StationKey.of('implementation'),
  },
]);

describe('SkillDefinition', () => {
  it('is created for a team under its skill’s key, and says so', () => {
    const created = SkillDefinition.create({
      ...parsed(),
      id: ID,
      teamId: TEAM,
      reading: READING,
      by: BY,
    });

    expect(created.key.value).toBe('grafana');
    expect(created.isNew).toBe(true);
    expect(created.pullEvents()).toEqual([
      new SkillCreated(
        ID,
        TEAM,
        DefinedSkillKey.of('grafana'),
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
    const updated = stored().update(
      parsed('grafana', 'Search twice.'),
      READING,
      BY,
    );

    expect(updated.files.fields).toEqual({ 'SKILL.md': 'Search twice.' });
    expect(updated.pullEvents()).toEqual([
      new SkillUpdated(
        ID,
        TEAM,
        DefinedSkillKey.of('grafana'),
        ConfigurationChange.updated(GRAFANA, BY),
      ),
    ]);
  });

  it('keeps its key for its whole life', () => {
    expect(() => stored().update(parsed('loki'), READING, BY)).toThrow(
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
      StationUses.of([
        {
          used: SkillKey.of('loki'),
          line: LineKey.of('delivery'),
          station: StationKey.of('implementation'),
        },
      ]),
      BY,
    );

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new SkillDeleted(
        ID,
        TEAM,
        DefinedSkillKey.of('grafana'),
        ConfigurationChange.deleted(GRAFANA, BY),
      ),
    ]);
    expect(() => deleted.update(parsed(), READING, BY)).toThrow(
      InconsistentStateError,
    );
  });

  it('is deleted with its team, whichever station still enables it', () => {
    const deleted = stored().cascadeDelete(BY);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new SkillDeleted(
        ID,
        TEAM,
        DefinedSkillKey.of('grafana'),
        ConfigurationChange.deleted(GRAFANA, BY),
      ),
    ]);
  });

  it('reads its skill from its own files, and refuses one that is built in', () => {
    const builtIn: SkillFolderReading = {
      skillIn: (key) =>
        Skill.builtIn({
          key,
          description: 'Built in',
          instructions: 'Do it.',
          secrets: [],
          tools: [],
        }),
    };

    expect(() =>
      SkillDefinition.create({
        ...parsed('spotlight-review'),
        id: ID,
        teamId: TEAM,
        reading: builtIn,
        by: BY,
      }),
    ).toThrow(InvalidSkillError);
    expect(() => stored().update(parsed('grafana', ''), READING, BY)).toThrow(
      InvalidSkillError,
    );
  });
});
