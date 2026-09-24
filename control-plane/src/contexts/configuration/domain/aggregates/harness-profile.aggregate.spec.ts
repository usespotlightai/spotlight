import { HarnessProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import { HarnessProfileDefined } from '@configuration/domain/events/harness-profile-defined.event';
import { HarnessProfileRedefined } from '@configuration/domain/events/harness-profile-redefined.event';
import { HarnessProfileRetired } from '@configuration/domain/events/harness-profile-retired.event';
import { HarnessProfileInUseError } from '@configuration/domain/exceptions/harness-profile-in-use.error';
import { HarnessProfileKeyFixedError } from '@configuration/domain/exceptions/harness-profile-key-fixed.error';
import { HarnessProfileMovedOnError } from '@configuration/domain/exceptions/harness-profile-moved-on.error';
import { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
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

  it('refuses a change made against another version', () => {
    expect(() => kept(3).expecting(2)).toThrow(HarnessProfileMovedOnError);
  });

  it('takes new settings, and says so', () => {
    const redefined = kept().redefinedAs(
      read('careful', ['execute(git push *)']),
      BY,
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
    expect(() => kept().redefinedAs(read('bold'), BY)).toThrow(
      HarnessProfileKeyFixedError,
    );
  });

  it('will not retire while a station names it', () => {
    expect(() => kept().retired(NAMED, BY)).toThrow(HarnessProfileInUseError);
    expect(() => kept().retired(NAMED, BY)).toThrow(/delivery\/implementation/);
  });

  it('retires when no station names it, and cannot change after', () => {
    const retired = kept().retired(
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
    expect(() => retired.redefinedAs(read(), BY)).toThrow(
      InconsistentStateError,
    );
  });

  it('is abandoned with its team, whoever still names it', () => {
    const abandoned = kept().abandoned(BY);

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
});
