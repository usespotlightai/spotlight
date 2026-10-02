import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { CandidateWithdrawn } from '@replays/domain/events/candidate-withdrawn.event';
import { CandidateIsLiveError } from '@replays/domain/exceptions/candidate-is-live.error';
import { CandidateKeptBySpotlightError } from '@replays/domain/exceptions/candidate-kept-by-spotlight.error';
import { CandidateMovedOnError } from '@replays/domain/exceptions/candidate-moved-on.error';
import { CandidateUnderwayError } from '@replays/domain/exceptions/candidate-underway.error';
import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import {
  AT,
  BY,
  candidateOf,
  DIGESTS,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  NOW,
  STATION,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { describe, expect, it } from 'vitest';

const changeOf = (candidate: Candidate) => {
  const [event] = candidate.pullEvents() as ConfigurationChanged[];

  return event?.change;
};

describe('Candidate', () => {
  it('is proposed under a name, for one station, saying what it changes from the live config', () => {
    const proposed = candidateOf('proposed');

    expect(proposed.kind).toBe('proposed');
    expect(proposed.isLive).toBe(false);
    expect(proposed.name.value).toBe('Shorter prompt');
    expect(proposed.address.toString()).toBe(
      'core/delivery/build/Shorter prompt',
    );
    expect(proposed.changedFrom.from).toEqual(LIVE_FINGERPRINT);
    expect(proposed.changedFrom.changes.map((each) => each.part)).toEqual([
      'prompt',
    ]);
    expect(proposed.isFor(STATION.stationId)).toBe(true);
    expect(proposed.isFor('station_ship')).toBe(false);
  });

  it('records its proposal in the configuration audit, at its address', () => {
    const proposed = candidateOf('proposed');
    const [event] = proposed.pullEvents();

    expect(event).toBeInstanceOf(CandidateProposed);
    expect((event as CandidateProposed).change).toMatchObject({
      resource: 'replay-candidate',
      resourceId: 'candidate_proposed',
      key: 'core/delivery/build/Shorter prompt',
      action: 'created',
      by: BY,
    });
  });

  it('snapshots the live config under the day it was taken, changing nothing, unaudited', () => {
    const live = candidateOf('live');

    expect(live.kind).toBe('live');
    expect(live.name.value).toBe('Live config, 2026-10-01');
    expect(live.changedFrom.from).toEqual(FINGERPRINT);
    expect(live.changedFrom.changes).toEqual([]);
    expect(live.pullEvents()).toEqual([]);
  });

  it('keeps the key of the station it is for', () => {
    expect(() =>
      Candidate.proposed({
        id: CandidateId.of('candidate_1'),
        station: STATION,
        address: AT,
        name: CandidateName.of('Renamed'),
        block: StationBlock.of({ key: 'ship' }),
        fingerprint: FINGERPRINT,
        digests: DIGESTS,
        scoring: UNSCORED,
        changedFrom: StationChanges.none(LIVE_FINGERPRINT),
        at: NOW,
        by: BY,
      }),
    ).toThrow(InvalidCandidateError);
  });

  it('is withdrawn at the version asked for, when none of its replays is running', () => {
    const proposed = candidateOf('proposed');
    proposed.pullEvents();

    expect(() => proposed.expecting(1)).toThrow(CandidateMovedOnError);
    expect(() => proposed.withdrawn(true, BY)).toThrow(CandidateUnderwayError);

    const withdrawn = proposed.withdrawn(false, BY);

    expect(withdrawn.isAbandoned).toBe(true);
    expect(changeOf(withdrawn)).toMatchObject({
      resource: 'replay-candidate',
      action: 'deleted',
      by: BY,
    });
  });

  it('is never withdrawn when it is the live config Spotlight replays', () => {
    expect(() => candidateOf('live').withdrawn(false, BY)).toThrow(
      CandidateIsLiveError,
    );
  });

  it('is abandoned by Spotlight, recording the withdrawal only of a proposal', () => {
    const proposed = candidateOf('proposed');
    proposed.pullEvents();
    const live = candidateOf('live').abandoned();

    expect(live.isAbandoned).toBe(true);
    expect(live.pullEvents()).toEqual([]);

    const abandoned = proposed.abandoned();
    const [event] = abandoned.pullEvents();

    expect(event).toBeInstanceOf(CandidateWithdrawn);
    expect((event as CandidateWithdrawn).change.by).toEqual(
      Attribution.spotlight(STATION.workspaceId),
    );
  });

  it('is addressed by team, line and station keys, then its name', () => {
    const address = CandidateAddress.parse(
      'core/delivery/build/Shorter prompt',
    );

    expect(address.station).toEqual(AT);
    expect(address.name.value).toBe('Shorter prompt');
    for (const malformed of [
      'core/delivery/build',
      'core/delivery/build/ x',
      'core/delivery/build/a/b',
      'Core/delivery/build/x',
    ]) {
      expect(() => CandidateAddress.parse(malformed)).toThrow(
        InvalidCandidateError,
      );
    }
    expect(StationAddress.parsed('core/delivery/build')).toEqual(AT);
    expect(StationAddress.parsed('core/delivery')).toBeNull();
  });

  it('is named without surrounding spaces or slashes, and never as Spotlight names its live snapshots', () => {
    expect(CandidateName.proposed('Shorter prompt').value).toBe(
      'Shorter prompt',
    );
    for (const refused of [
      ' Shorter',
      'Shorter ',
      'a/b',
      '',
      'x'.repeat(101),
      'Live config, 2026-10-02',
      'live config tweak',
    ]) {
      expect(() => CandidateName.proposed(refused)).toThrow(
        InvalidCandidateError,
      );
    }
    expect(CandidateName.live(NOW).value).toBe('Live config, 2026-10-01');
  });

  it('holds a station block with a key, and a SHA-256 fingerprint', () => {
    expect(() => StationBlock.of(['build'])).toThrow(InvalidCandidateError);
    expect(() => StationBlock.of({ name: 'Build' })).toThrow(
      InvalidCandidateError,
    );
    expect(() => StationFingerprint.of('abc')).toThrow(InvalidCandidateError);
    expect(StationBlock.of({ key: 'build', prompt: 'Go' }).value).toEqual({
      key: 'build',
      prompt: 'Go',
    });
  });

  describe('made by Spotlight', () => {
    const made = {
      station: STATION,
      address: AT,
      block: StationBlock.of({ key: 'build', name: 'Build', prompt: 'Go.' }),
      fingerprint: FINGERPRINT,
      digests: DIGESTS,
      scoring: UNSCORED,
      at: NOW,
    };

    const searched = (name = 'terse-prompt', iteration = 2) =>
      Candidate.searched({
        ...made,
        id: CandidateId.of('candidate_searched'),
        name,
        changedFrom: StationChanges.none(LIVE_FINGERPRINT),
        search: {
          searchId: SearchId.of('search_1'),
          iteration,
          hypothesis: Hypothesis.of('  A shorter prompt keeps it on task.  '),
        },
      });

    const planned = (reference = PlannedReference.of({ pullRequest: 42 })) =>
      Candidate.planned({
        ...made,
        id: CandidateId.of('candidate_planned'),
        changedFrom: StationChanges.none(LIVE_FINGERPRINT),
        reference,
        line: null,
      });

    it('is found by a search, naming the search, its iteration and hypothesis, without an audit record', () => {
      const candidate = searched();

      expect(candidate.kind).toBe('searched');
      expect(candidate.isProposed).toBe(false);
      expect(candidate.name.value).toBe('terse-prompt');
      expect(candidate.search?.searchId.value).toBe('search_1');
      expect(candidate.search?.iteration).toBe(2);
      expect(candidate.search?.hypothesis.value).toBe(
        'A shorter prompt keeps it on task.',
      );
      expect(candidate.pullEvents()).toEqual([]);
    });

    it('is named as a slug when a search finds it', () => {
      for (const name of ['a', 'terse-prompt', '0-shot', 'x'.repeat(63)]) {
        expect(CandidateName.searched(name).value).toBe(name);
      }
      for (const refused of [
        '',
        '-lead',
        'Upper',
        'with space',
        'a/b',
        'a.b',
        '..',
        'x'.repeat(64),
      ]) {
        expect(() => CandidateName.searched(refused)).toThrow(
          InvalidCandidateError,
        );
      }
      expect(() => searched('terse', 0)).toThrow(InvalidCandidateError);
    });

    it('says what it hopes for in 1 to 4,000 characters', () => {
      expect(Hypothesis.of('x'.repeat(4_000)).value).toHaveLength(4_000);
      for (const refused of ['', '   ', 'x'.repeat(4_001)]) {
        expect(() => Hypothesis.of(refused)).toThrow(InvalidCandidateError);
      }
    });

    it('is planned in a change, named for its pull request or commit', () => {
      expect(planned().kind).toBe('planned');
      expect(planned().name.value).toBe('Planned change, PR #42');
      expect(planned().reference?.pullRequest).toBe(42);
      expect(
        planned(PlannedReference.of({ commit: 'ABCDEF0123456' })).name.value,
      ).toBe('Planned change, abcdef0');
      expect(planned(PlannedReference.of({})).name.value).toBe(
        'Planned change, 2026-10-01',
      );
      expect(() => PlannedReference.of({ commit: 'not-a-sha' })).toThrow(
        InvalidCandidateError,
      );
      expect(() => PlannedReference.of({ pullRequest: 0 })).toThrow(
        InvalidCandidateError,
      );
      expect(() => CandidateName.proposed('Planned change, PR #1')).toThrow(
        InvalidCandidateError,
      );
    });

    it('is never withdrawn by a person, and goes quietly when abandoned', () => {
      for (const candidate of [searched(), planned()]) {
        expect(() => candidate.withdrawn(false, BY)).toThrow(
          CandidateKeptBySpotlightError,
        );

        const abandoned = candidate.abandoned();

        expect(abandoned.isAbandoned).toBe(true);
        expect(abandoned.pullEvents()).toEqual([]);
      }
    });

    it('is stored with what made it, and only that', () => {
      const candidate = searched();
      const state = {
        id: candidate.id,
        station: candidate.station,
        address: candidate.stationAddress,
        name: candidate.name,
        block: candidate.block,
        fingerprint: candidate.fingerprint,
        digests: candidate.digests,
        line: null,
        scoring: candidate.scoring,
        changedFrom: candidate.changedFrom,
        createdAt: NOW,
        version: 0,
      };

      expect(() =>
        Candidate.rehydrate({
          ...state,
          kind: 'searched',
          search: null,
          reference: null,
        }),
      ).toThrow(InconsistentStateError);
      expect(() =>
        Candidate.rehydrate({
          ...state,
          kind: 'proposed',
          search: candidate.search,
          reference: null,
        }),
      ).toThrow(InconsistentStateError);
      expect(() =>
        Candidate.rehydrate({
          ...state,
          kind: 'planned',
          search: null,
          reference: null,
        }),
      ).toThrow(InconsistentStateError);
    });
  });
});
