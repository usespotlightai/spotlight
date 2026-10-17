import { ProposeCandidateHandler } from '@replays/application/commands/handlers/propose-candidate.handler';
import { WithdrawCandidateHandler } from '@replays/application/commands/handlers/withdraw-candidate.handler';
import { ProposeCandidateCommand } from '@replays/application/commands/propose-candidate.command';
import { WithdrawCandidateCommand } from '@replays/application/commands/withdraw-candidate.command';
import {
  ACTOR,
  CLOCK,
  FakeWork,
  IDS,
  InMemoryReplays,
  peopleWho,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { CandidateProposed } from '@replays/domain/events/candidate-proposed.event';
import { CandidateWithdrawn } from '@replays/domain/events/candidate-withdrawn.event';
import { CandidateNameTakenError } from '@replays/domain/exceptions/candidate-name-taken.error';
import { aReplay, candidateOf } from '@replays/domain/replays.fake-spec';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;

const FRESH: IdempotentCreatesPort = {
  claim: async () => ({ kind: 'fresh' }),
  created: async () => {},
};

const BLOCK = { key: 'build', name: 'Build', kind: 'work', prompt: 'Go.' };

const proposing = (mayPlan: boolean | null = true) =>
  new ProposeCandidateHandler(
    peopleWho(mayPlan),
    work,
    memory.candidateRepository,
    FRESH,
    IDS,
    CLOCK,
    TRANSACTION,
  );

const propose = (definition: unknown, mayPlan: boolean | null = true) =>
  proposing(mayPlan).execute(
    new ProposeCandidateCommand('line_1', 'build', ACTOR, 'key-1', definition),
  );

const withdraw = (id: string, version = 0, mayPlan: boolean | null = true) =>
  new WithdrawCandidateHandler(
    peopleWho(mayPlan),
    memory.candidateRepository,
    memory.replayRepository,
    TRANSACTION,
  ).execute(new WithdrawCandidateCommand(id, ACTOR, version));

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
});

describe('ProposeCandidateHandler', () => {
  it('proposes a candidate at its station’s address, recording who proposed it', async () => {
    const proposed = await propose({ name: 'Shorter', station: BLOCK });

    expect(proposed).toEqual({
      outcome: 'created',
      id: expect.any(String),
      replayed: false,
    });

    const stored = [...memory.candidates.values()][0];
    expect(stored?.address.toString()).toBe('core/delivery/build/Shorter');
    expect(memory.events[0]).toBeInstanceOf(CandidateProposed);
  });

  it('finds nothing for one who cannot see the team, nor at a station the line lacks', async () => {
    expect(await propose({ name: 'Shorter', station: BLOCK }, null)).toBeNull();
    expect(
      await proposing().execute(
        new ProposeCandidateCommand('line_1', 'polish', ACTOR, 'key-1', {}),
      ),
    ).toBeNull();
  });

  it('refuses one who may read but not plan, before looking at what was proposed', async () => {
    expect(await propose({}, false)).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
  });

  it('refuses a nameless proposal, and says what the station block gets wrong beside it', async () => {
    const wrong = ConfigurationProblem.of({
      path: '',
      at: FieldPath.of(['station', 'harness']),
      reason: 'names a harness a runner can start',
    });
    work.examine = async () => ({ ok: false as const, problems: [wrong] });

    const refused = await propose({ name: '  ', station: BLOCK });

    expect(refused?.outcome).toBe('invalid');
    expect(
      refused?.outcome === 'invalid'
        ? refused.problems.map((each) => each.field.rendered)
        : [],
    ).toEqual(['name', 'station.harness']);
  });

  it('answers a name the station’s candidates already use with the address it is at', async () => {
    memory.candidateRepository.add = async (candidate) => {
      throw new CandidateNameTakenError(candidate.address.toString());
    };

    expect(await propose({ name: 'Shorter', station: BLOCK })).toEqual({
      outcome: 'taken',
      address: 'core/delivery/build/Shorter',
    });
  });
});

describe('WithdrawCandidateHandler', () => {
  beforeEach(async () => {
    await memory.candidateRepository.add(candidateOf('proposed'));
    await memory.candidateRepository.add(candidateOf('live'));
    memory.events.length = 0;
  });

  it('withdraws a proposed candidate none of whose replays runs, recording it', async () => {
    expect(await withdraw('candidate_proposed')).toEqual({
      outcome: 'deleted',
    });
    expect(memory.candidates.has('candidate_proposed')).toBe(false);
    expect(memory.events[0]).toBeInstanceOf(CandidateWithdrawn);
  });

  it('keeps a candidate a replay is running, and the live config Spotlight replays', async () => {
    await memory.replayRepository.add(aReplay({ count: 1 }));

    expect(await withdraw('candidate_proposed')).toMatchObject({
      outcome: 'in-use',
    });
    expect(await withdraw('candidate_live')).toMatchObject({
      outcome: 'in-use',
    });
  });

  it('refuses a version it is not at, naming the one it is', async () => {
    expect(await withdraw('candidate_proposed', 3)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 0,
    });
  });

  it('refuses one who may not plan, and finds nothing for one who cannot see it', async () => {
    expect(await withdraw('candidate_proposed', 0, false)).toEqual({
      outcome: 'forbidden',
      act: 'plan',
    });
    expect(await withdraw('candidate_proposed', 0, null)).toBeNull();
    expect(await withdraw('candidate_elsewhere')).toBeNull();
  });
});
