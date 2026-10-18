import { ReadCandidateHandler } from '@replays/application/queries/handlers/read-candidate.handler';
import { ReadCandidateQuery } from '@replays/application/queries/read-candidate.query';
import {
  InMemoryReplays,
  PERSON,
  peopleWho,
} from '@replays/application/services/replays.fake-spec';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import {
  AT,
  candidateOf,
  FINGERPRINT,
  HASHES,
  LIVE_FINGERPRINT,
  NOW,
  SEARCH_ID,
  STATION,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;

const made = {
  station: STATION,
  address: AT,
  block: StationBlock.of({ key: 'build', name: 'Build', prompt: 'Go.' }),
  fingerprint: FINGERPRINT,
  hashes: HASHES,
  scoring: UNSCORED,
  changedFrom: StationChanges.none(LIVE_FINGERPRINT),
  at: NOW,
};

const read = (id: string) =>
  new ReadCandidateHandler(peopleWho(true), memory.candidateRepository).execute(
    new ReadCandidateQuery(id, PERSON),
  );

beforeEach(async () => {
  memory = new InMemoryReplays();
  await memory.candidateRepository.add(candidateOf('proposed'));
  await memory.candidateRepository.add(
    Candidate.fromSearch({
      ...made,
      id: CandidateId.of('candidate_searched'),
      name: 'terse',
      search: {
        searchId: SEARCH_ID,
        iteration: 1,
        hypothesis: Hypothesis.of('Shorter keeps it on task.'),
      },
    }),
  );
  await memory.candidateRepository.add(
    Candidate.plan({
      ...made,
      id: CandidateId.of('candidate_planned'),
      reference: PlannedReference.of({ pullRequest: 3 }),
      line: null,
    }),
  );
});

describe('ReadCandidateHandler', () => {
  it('reads a proposed candidate', async () => {
    expect((await read('candidate_proposed'))?.id).toBe('candidate_proposed');
  });

  it('shows no candidate a search found or a plan made, as if there were none', async () => {
    expect(await read('candidate_searched')).toBeNull();
    expect(await read('candidate_planned')).toBeNull();
  });
});
