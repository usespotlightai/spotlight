import { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { HarnessProfileCreated } from '@configuration/domain/events/harness-profile-created.event';
import { HarnessProfileDeleted } from '@configuration/domain/events/harness-profile-deleted.event';
import { HarnessProfileUpdated } from '@configuration/domain/events/harness-profile-updated.event';
import { HarnessProfileInUseError } from '@configuration/domain/exceptions/harness-profile-in-use.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = HarnessProfileId.of('profile_1');

const settings = (ask: string[] = []) =>
  ProfileSettings.fromRaw({
    permissions: { allow: ['read'], ask, deny: [] },
    mcpServers: [],
    native: {},
  });

const parsed = (key = 'careful', ask: string[] = []) => ({
  key: ProfileKey.of(key),
  settings: settings(ask),
});

const stored = (version = 3) =>
  HarnessProfile.rehydrate({
    id: ID,
    teamId: TEAM,
    key: ProfileKey.of('careful'),
    settings: settings(),
    version,
  });

const BY = changeActorIn();

const CAREFUL = {
  resource: 'harness-profile' as const,
  id: 'profile_1',
  key: 'careful',
};

const NAMED = StationUses.of([
  { name: 'careful', by: 'delivery/implementation' },
]);

describe('HarnessProfile', () => {
  it('is created for a team under its key, and says so', () => {
    const created = HarnessProfile.create({
      ...parsed(),
      id: ID,
      teamId: TEAM,
      by: BY,
      existingSecrets: [],
    });

    expect(created.isNew).toBe(true);
    expect(created.pullEvents()).toEqual([
      new HarnessProfileCreated(
        ID,
        TEAM,
        ProfileKey.of('careful'),
        ConfigurationChange.created(CAREFUL, BY),
      ),
    ]);
  });

  it('rejects a change made against another version', () => {
    expect(() => stored(3).assertVersion(2)).toThrow(
      HarnessProfileVersionConflictError,
    );
  });

  it('takes new settings, and says so', () => {
    const updated = stored().update(
      parsed('careful', ['execute(git push *)']),
      BY,
      [],
    );

    expect(updated.settings.permissions.ask).toEqual(['execute(git push *)']);
    expect(updated.pullEvents()).toEqual([
      new HarnessProfileUpdated(
        ID,
        TEAM,
        ProfileKey.of('careful'),
        ConfigurationChange.updated(CAREFUL, BY),
      ),
    ]);
  });

  it('keeps its key for its whole life', () => {
    expect(() => stored().update(parsed('bold'), BY, [])).toThrow(
      ImmutableFieldError,
    );
  });

  it('will not be deleted while a station names it', () => {
    expect(() => stored().delete(NAMED, BY)).toThrow(HarnessProfileInUseError);
    expect(() => stored().delete(NAMED, BY)).toThrow(
      /delivery\/implementation/,
    );
  });

  it('is deleted when no station names it, and cannot change after', () => {
    const deleted = stored().delete(
      StationUses.of([{ name: 'bold', by: 'delivery/implementation' }]),
      BY,
    );

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new HarnessProfileDeleted(
        ID,
        TEAM,
        ProfileKey.of('careful'),
        ConfigurationChange.deleted(CAREFUL, BY),
      ),
    ]);
    expect(() => deleted.update(parsed(), BY, [])).toThrow(
      InconsistentStateError,
    );
  });

  it('is deleted with its team, whoever still names it', () => {
    const deleted = stored().cascadeDelete(BY);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new HarnessProfileDeleted(
        ID,
        TEAM,
        ProfileKey.of('careful'),
        ConfigurationChange.deleted(CAREFUL, BY),
      ),
    ]);
  });

  it('names only secrets the workspace has in its MCP servers’ env', () => {
    const referring = {
      key: ProfileKey.of('careful'),
      settings: ProfileSettings.fromRaw({
        permissions: { allow: [], ask: [], deny: [] },
        mcpServers: [
          {
            name: 'linear',
            command: 'npx',
            args: [],
            env: { LINEAR_API_KEY: 'secret.LINEAR_API_KEY' },
          },
        ],
        native: {},
      }),
    };
    const existing = [SecretName.of('LINEAR_API_KEY')];

    expect(() =>
      HarnessProfile.create({
        ...referring,
        id: ID,
        teamId: TEAM,
        by: BY,
        existingSecrets: [],
      }),
    ).toThrow(MissingSecretsError);
    expect(() => stored().update(referring, BY, [])).toThrow(
      MissingSecretsError,
    );
    expect(
      stored()
        .update(referring, BY, existing)
        .settings.uses(existing[0] as SecretName),
    ).toBe(true);
  });
});
