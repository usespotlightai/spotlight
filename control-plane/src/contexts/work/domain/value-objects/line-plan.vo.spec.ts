import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { InvalidLinePlanError } from '@work/domain/exceptions/invalid-line-plan.error';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import {
  LinePlan,
  type StationPlan,
} from '@work/domain/value-objects/line-plan.vo';
import { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import { StationAlert } from '@work/domain/value-objects/station-alert.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { describe, expect, it } from 'vitest';

const MERGED = Happening.of('github.pull_request.merged');

const station = (
  key: string,
  over: Partial<StationPlan> = {},
): StationPlan => ({
  key: StationKey.of(key),
  name: StationName.of(key),
  kind: 'work',
  color: StationColor.of('#a3a8b0'),
  description: null,
  harness: null,
  model: null,
  effort: null,
  profile: null,
  agentPrompt: null,
  check: null,
  placement: RunnerPlacement.anywhere(),
  diffs: false,
  decisions: false,
  memories: false,
  judge: null,
  alerts: [],
  tools: [],
  skills: [],
  passesTo: [],
  ends: false,
  ...over,
});

const backlog = (over: Partial<StationPlan> = {}) =>
  station('backlog', { kind: 'backlog', ...over });

const completed = (over: Partial<StationPlan> = {}) =>
  station('completed', { kind: 'completed', ...over });

const plan = (over: Partial<Parameters<typeof LinePlan.of>[0]> = {}) =>
  LinePlan.of({
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      backlog({ passesTo: [StationKey.of('code-review')] }),
      station('code-review', { ends: true }),
      completed(),
    ],
    ...over,
  });

const worked = (name: string, setup?: string) =>
  WorkedRepository.of(Repository.of(name), {
    setup: setup ? RepositorySetup.of(setup) : null,
  });

const checking = (over: Partial<StationPlan> = {}) =>
  station('code-review', {
    ends: true,
    check: StationCheck.of('npm test'),
    diffs: true,
    ...over,
  });

const withStations = (middle: StationPlan) => [
  backlog({ passesTo: [StationKey.of('code-review')] }),
  middle,
  completed(),
];

const refusal = (make: () => unknown): InvalidLinePlanError => {
  try {
    make();
  } catch (error) {
    if (error instanceof InvalidLinePlanError) {
      return error;
    }
    throw error;
  }
  throw new Error('was not refused');
};

describe('LinePlan', () => {
  it('describes a line, its stations and what words do to a task', () => {
    const held = plan({
      reactions: [
        {
          happening: MERGED,
          from: null,
          to: StationKey.of('completed'),
        },
      ],
      repositories: [
        WorkedRepository.of(Repository.of('acme/api'), {
          image: RunnerImage.of('ghcr.io/acme/api:1'),
        }),
      ],
    });

    expect(held.key.value).toBe('default');
    expect(held.stations.map((each) => each.key.value)).toEqual([
      'backlog',
      'code-review',
      'completed',
    ]);
    expect(held.reactions).toHaveLength(1);
    expect(held.role).toBeNull();
    expect(held.repositories.all.map((each) => each.value)).toEqual([
      'acme/api',
    ]);
    expect(held.repositories.image?.value).toBe('ghcr.io/acme/api:1');
  });

  it('refuses one describing no stations at all', () => {
    const refused = refusal(() => plan({ stations: [] }));

    expect(refused.message).toMatch(/at least one/);
    expect(refused.part).toEqual({ of: 'line', field: 'stations' });
  });

  it('refuses one naming a station twice', () => {
    expect(() =>
      plan({
        stations: [
          backlog(),
          station('code-review'),
          station('code-review'),
          completed(),
        ],
      }),
    ).toThrow(/two are named code-review/);
  });

  it('refuses one that does not open with its backlog', () => {
    expect(() =>
      plan({ stations: [station('code-review'), backlog(), completed()] }),
    ).toThrow(/open with their backlog/);
    expect(() =>
      plan({ stations: [station('code-review'), completed()] }),
    ).toThrow(/one backlog, but hold 0/);
  });

  it('refuses one that does not close with completed', () => {
    expect(() =>
      plan({ stations: [backlog(), completed(), station('code-review')] }),
    ).toThrow(/close with completed/);
    expect(() =>
      plan({ stations: [backlog(), station('code-review')] }),
    ).toThrow(/one completed, but hold 0/);
  });

  it('refuses work passing on from where the line ends', () => {
    const refused = refusal(() =>
      plan({
        stations: [
          backlog(),
          station('code-review'),
          completed({ passesTo: [StationKey.of('code-review')] }),
        ],
      }),
    );

    expect(refused.message).toMatch(/completed hands on somewhere/);
    expect(refused.part).toEqual({
      of: 'station',
      station: 'completed',
      field: 'passesTo',
    });
  });

  it('refuses a station handing work on to itself', () => {
    const refused = refusal(() =>
      plan({
        stations: [
          backlog(),
          station('code-review', {
            passesTo: [StationKey.of('code-review')],
          }),
          completed(),
        ],
      }),
    );

    expect(refused.message).toMatch(/hand on to themselves/);
    expect(refused.part).toEqual({
      of: 'station',
      station: 'code-review',
      field: 'passesTo',
    });
  });

  it('refuses work passing to a station it does not describe', () => {
    const refused = refusal(() =>
      plan({
        stations: [
          backlog({ passesTo: [StationKey.of('nowhere')] }),
          station('code-review'),
          completed(),
        ],
      }),
    );

    expect(refused.message).toMatch(/station work is done at/);
    expect(refused.part).toEqual({
      of: 'station',
      station: 'backlog',
      field: 'passesTo',
    });
  });

  it('refuses a judge at the backlog, where nothing runs to be judged', () => {
    const refused = refusal(() =>
      plan({
        stations: [
          backlog({
            passesTo: [StationKey.of('code-review')],
            judge: StationJudge.of({
              rubric: 'A good run.',
              sample: 0.2,
              trust: 0.6,
            }),
          }),
          station('code-review', { ends: true }),
          completed(),
        ],
      }),
    );

    expect(refused.message).toMatch(/no runs to judge/);
    expect(refused.part).toEqual({
      of: 'station',
      station: 'backlog',
      field: 'judge',
    });
  });

  it('refuses alerts where the line ends, since nothing runs there', () => {
    const refused = refusal(() =>
      plan({
        stations: [
          backlog({ passesTo: [StationKey.of('code-review')] }),
          station('code-review', { ends: true }),
          completed({
            alerts: [
              StationAlert.of({ measure: 'failed_rate', above: 0.1, over: 5 }),
            ],
          }),
        ],
      }),
    );

    expect(refused.part).toEqual({
      of: 'station',
      station: 'completed',
      field: 'alerts',
    });
  });

  it('lets a work station keep a judge and alerts', () => {
    expect(() =>
      plan({
        stations: withStations(
          station('code-review', {
            ends: true,
            judge: StationJudge.of({
              rubric: 'A good run.',
              sample: 0.2,
              trust: 0.6,
            }),
            alerts: [
              StationAlert.of({
                measure: 'sent_back_rate',
                risesBy: 0.2,
                over: 20,
              }),
            ],
          }),
        ),
      }),
    ).not.toThrow();
  });

  it('refuses work passing to a station nobody works', () => {
    expect(() =>
      plan({
        stations: [
          backlog({ passesTo: [StationKey.of('completed')] }),
          station('code-review'),
          completed(),
        ],
      }),
    ).toThrow(/station work is done at/);
  });

  it('refuses a word taking a task to a station it does not describe', () => {
    const refused = refusal(() =>
      plan({
        reactions: [
          {
            happening: MERGED,
            from: null,
            to: StationKey.of('nowhere'),
          },
        ],
      }),
    );

    expect(refused.message).toMatch(/to a station on the line/);
    expect(refused.part).toEqual({ of: 'reaction', place: 0, field: 'to' });
  });

  it('refuses a word waiting at a station it does not describe', () => {
    const refused = refusal(() =>
      plan({
        reactions: [
          {
            happening: MERGED,
            from: StationKey.of('nowhere'),
            to: StationKey.of('code-review'),
          },
        ],
      }),
    );

    expect(refused.message).toMatch(/at a station on the line/);
    expect(refused.part).toEqual({ of: 'reaction', place: 0, field: 'from' });
  });

  it('refuses two stations waiting for the same word from the same place', () => {
    const refused = refusal(() =>
      plan({
        reactions: [
          { happening: MERGED, from: null, to: StationKey.of('code-review') },
          { happening: MERGED, from: null, to: StationKey.of('completed') },
        ],
      }),
    );

    expect(refused.message).toMatch(/two wait for/);
    expect(refused.part).toEqual({ of: 'reaction', place: 1, field: null });
  });

  it('refuses repositories it could not work in', () => {
    const repository = WorkedRepository.of(Repository.of('acme/api'));
    const refused = refusal(() =>
      plan({ repositories: [repository, repository] }),
    );

    expect(refused.part).toEqual({ of: 'line', field: 'repositories' });
  });

  it('refuses repositories that would run in different images', () => {
    const refused = refusal(() =>
      plan({
        repositories: [
          WorkedRepository.of(Repository.of('acme/api'), {
            image: RunnerImage.of('ghcr.io/acme/api:1'),
          }),
          WorkedRepository.of(Repository.of('acme/web'), {
            image: RunnerImage.of('ghcr.io/acme/web:1'),
          }),
        ],
      }),
    );

    expect(refused.part).toEqual({ of: 'line', field: 'repositories' });
  });

  it('refuses a station checking its layers while a repository says nothing of how its checkout is made ready', () => {
    const refused = refusal(() =>
      plan({
        stations: withStations(checking()),
        repositories: [worked('acme/api', 'npm ci'), worked('acme/web')],
      }),
    );

    expect(refused.message).toMatch(/code-review, which checks its layers/);
    expect(refused.message).toMatch(/acme\/web/);
    expect(refused.part).toEqual({
      of: 'repository',
      place: 1,
      field: 'setup',
    });
  });

  it('holds a station checking its layers once every repository says how its checkout is made ready', () => {
    const held = plan({
      stations: withStations(checking()),
      repositories: [worked('acme/api', 'npm ci'), worked('acme/web', 'make')],
    });

    expect(held.repositories.setupOf(Repository.of('acme/web'))?.value).toBe(
      'make',
    );
  });

  it('asks no setup of repositories when no station checks its layers', () => {
    expect(() =>
      plan({
        stations: withStations(checking({ diffs: false })),
        repositories: [worked('acme/api')],
      }),
    ).not.toThrow();
    expect(() =>
      plan({
        stations: withStations(checking({ check: null })),
        repositories: [worked('acme/api')],
      }),
    ).not.toThrow();
  });

  it('says whether it names a station at all', () => {
    expect(plan().names(StationKey.of('code-review'))).toBe(true);
    expect(plan().names(StationKey.of('nowhere'))).toBe(false);
  });
});
