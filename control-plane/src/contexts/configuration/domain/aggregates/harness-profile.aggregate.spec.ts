import { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { HarnessProfileDefined } from '@configuration/domain/events/harness-profile-defined.event';
import { HarnessProfileRedefined } from '@configuration/domain/events/harness-profile-redefined.event';
import { HarnessProfileRetired } from '@configuration/domain/events/harness-profile-retired.event';
import { HarnessProfileInUseError } from '@configuration/domain/exceptions/harness-profile-in-use.error';
import { HarnessProfileKeyFixedError } from '@configuration/domain/exceptions/harness-profile-key-fixed.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const ID = HarnessProfileId.of('profile_1');

const settings = (ask: string[] = []) =>
  ProfileSettings.written({
    permissions: { allow: ['read'], ask, deny: [] },
    mcpServers: [],
    native: {},
  });

const read = (key = 'careful', ask: string[] = []) => ({
  key: ProfileKey.of(key),
  settings: settings(ask),
});

const kept = (version = 3) =>
  HarnessProfile.rehydrate({
    id: ID,
    teamId: TEAM,
    key: ProfileKey.of('careful'),
    settings: settings(),
    version,
  });

const BY = attributedIn();

const CAREFUL = {
  resource: 'harness-profile' as const,
  id: 'profile_1',
  key: 'careful',
};

const NAMED = StationUses.of([
  { name: 'careful', by: 'delivery/implementation' },
]);

describe('HarnessProfile', () => {
  it('is defined for a team under its key, and says so', () => {
    const defined = HarnessProfile.define({
      ...read(),
      id: ID,
      teamId: TEAM,
      by: BY,
      existingSecrets: [],
    });

    expect(defined.isNew).toBe(true);
    expect(defined.pullEvents()).toEqual([
      new HarnessProfileDefined(
        ID,
        TEAM,
        ProfileKey.of('careful'),
        ConfigurationChange.created(CAREFUL, BY),
      ),
    ]);
  });

  it('rejects a change made against another version', () => {
    expect(() => kept(3).assertVersion(2)).toThrow(
      HarnessProfileVersionConflictError,
    );
  });

  it('takes new settings, and says so', () => {
    const redefined = kept().redefinedAs(
      read('careful', ['execute(git push *)']),
      BY,
      [],
    );

    expect(redefined.settings.permissions.ask).toEqual(['execute(git push *)']);
    expect(redefined.pullEvents()).toEqual([
      new HarnessProfileRedefined(
        ID,
        TEAM,
        ProfileKey.of('careful'),
        ConfigurationChange.updated(CAREFUL, BY),
      ),
    ]);
  });

  it('keeps its key for its whole life', () => {
    expect(() => kept().redefinedAs(read('bold'), BY, [])).toThrow(
      HarnessProfileKeyFixedError,
    );
  });

  it('will not retire while a station names it', () => {
    expect(() => kept().retire(NAMED, BY)).toThrow(HarnessProfileInUseError);
    expect(() => kept().retire(NAMED, BY)).toThrow(/delivery\/implementation/);
  });

  it('retires when no station names it, and cannot change after', () => {
    const retired = kept().retire(
      StationUses.of([{ name: 'bold', by: 'delivery/implementation' }]),
      BY,
    );

    expect(retired.isRetired).toBe(true);
    expect(retired.pullEvents()).toEqual([
      new HarnessProfileRetired(
        ID,
        TEAM,
        ProfileKey.of('careful'),
        ConfigurationChange.deleted(CAREFUL, BY),
      ),
    ]);
    expect(() => retired.redefinedAs(read(), BY, [])).toThrow(
      InconsistentStateError,
    );
  });

  it('is abandoned with its team, whoever still names it', () => {
    const abandoned = kept().abandon(BY);

    expect(abandoned.isRetired).toBe(true);
    expect(abandoned.pullEvents()).toEqual([
      new HarnessProfileRetired(
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
      settings: ProfileSettings.written({
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
      HarnessProfile.define({
        ...referring,
        id: ID,
        teamId: TEAM,
        by: BY,
        existingSecrets: [],
      }),
    ).toThrow(MissingSecretsError);
    expect(() => kept().redefinedAs(referring, BY, [])).toThrow(
      MissingSecretsError,
    );
    expect(
      kept()
        .redefinedAs(referring, BY, existing)
        .settings.uses(existing[0] as SecretName),
    ).toBe(true);
  });
});
