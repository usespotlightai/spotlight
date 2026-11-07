import { InvalidLinePlanError } from '@lines/domain/exceptions/invalid-line-plan.error';
import {
  LinePlan,
  type StationPlan,
} from '@lines/domain/value-objects/line-plan.vo';
import { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import { RepositorySetup } from '@lines/domain/value-objects/repository-setup.vo';
import {
  LineSearchPolicy,
  StationSearchOverride,
} from '@lines/domain/value-objects/search-policy.vo';
import { StationAlert } from '@lines/domain/value-objects/station-alert.vo';
import { StationCheck } from '@lines/domain/value-objects/station-check.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
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
  search: null,
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

const repositoryConfig = (name: string, setup?: string) =>
  LineRepositoryConfig.of(Repository.of(name), {
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

const errorOf = (make: () => unknown): InvalidLinePlanError => {
  try {
    make();
  } catch (error) {
    if (error instanceof InvalidLinePlanError) {
      return error;
    }
    throw error;
  }
  throw new Error('was not rejected');
};

describe('LinePlan', () => {
  it('describes a line, its stations and what words do to a task', () => {
    const parsed = plan({
      reactions: [
        {
          happening: MERGED,
          from: null,
          to: StationKey.of('completed'),
        },
      ],
      repositories: [
        LineRepositoryConfig.of(Repository.of('acme/api'), {
          image: RunnerImage.of('ghcr.io/acme/api:1'),
        }),
      ],
    });

    expect(parsed.key.value).toBe('default');
    expect(parsed.stations.map((each) => each.key.value)).toEqual([
      'backlog',
      'code-review',
      'completed',
    ]);
    expect(parsed.reactions).toHaveLength(1);
    expect(parsed.role).toBeNull();
    expect(
      parsed.repositories.entries.map((each) => each.repository.value),
    ).toEqual(['acme/api']);
    expect(parsed.repositories.image?.value).toBe('ghcr.io/acme/api:1');
  });

  it('rejects one describing no stations at all', () => {
    const error = errorOf(() => plan({ stations: [] }));

    expect(error.message).toMatch(/at least one/);
    expect(error.flaw).toEqual({ in: 'line', rule: 'stations' });
  });

  it('rejects one naming a station twice', () => {
    expect(() =>
      plan({
        stations: [
          backlog(),
          station('code-review'),
          station('code-review'),
          completed(),
        ],
      }),
    ).toThrow(/code-review repeats/);
  });

  it('rejects one that does not open with its backlog', () => {
    expect(() =>
      plan({ stations: [station('code-review'), backlog(), completed()] }),
    ).toThrow(/must start with the backlog/);
    expect(() =>
      plan({ stations: [station('code-review'), completed()] }),
    ).toThrow(/exactly one backlog, not 0/);
  });

  it('rejects one that does not close with completed', () => {
    expect(() =>
      plan({ stations: [backlog(), completed(), station('code-review')] }),
    ).toThrow(/must end with the completed station/);
    expect(() =>
      plan({ stations: [backlog(), station('code-review')] }),
    ).toThrow(/exactly one completed station, not 0/);
  });

  it('rejects work passing on from where the line ends', () => {
    const error = errorOf(() =>
      plan({
        stations: [
          backlog(),
          station('code-review'),
          completed({ passesTo: [StationKey.of('code-review')] }),
        ],
      }),
    );

    expect(error.message).toMatch(/cannot pass on from the completed station/);
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('completed'),
      rule: 'routes',
    });
  });

  it('rejects a station passing work to itself', () => {
    const error = errorOf(() =>
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

    expect(error.message).toMatch(/cannot pass to themselves/);
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('code-review'),
      rule: 'routes',
    });
  });

  it('rejects work passing to a station it does not describe', () => {
    const error = errorOf(() =>
      plan({
        stations: [
          backlog({ passesTo: [StationKey.of('nowhere')] }),
          station('code-review'),
          completed(),
        ],
      }),
    );

    expect(error.message).toMatch(/must pass to work stations/);
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('backlog'),
      rule: 'routes',
    });
  });

  it('rejects a judge at the backlog, where nothing runs to be judged', () => {
    const error = errorOf(() =>
      plan({
        stations: [
          backlog({
            passesTo: [StationKey.of('code-review')],
            judge: StationJudge.of({
              rubric: 'A good run.',
              sample: 0.2,
              minAgreement: 0.6,
            }),
          }),
          station('code-review', { ends: true }),
          completed(),
        ],
      }),
    );

    expect(error.message).toMatch(/no runs to judge/);
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('backlog'),
      rule: 'judge',
    });
  });

  it('rejects a harness at the completed station, where no agent runs', () => {
    const error = errorOf(() =>
      plan({
        stations: [
          backlog({ passesTo: [StationKey.of('code-review')] }),
          station('code-review', { ends: true }),
          completed({ harness: HarnessId.of('claude-code') }),
        ],
      }),
    );

    expect(error.message).toMatch(/runs no agent, so it takes no harness/);
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('completed'),
      rule: 'harness',
    });
  });

  it('rejects search settings at the backlog, where nothing runs to improve', () => {
    const error = errorOf(() =>
      plan({
        stations: [
          backlog({
            passesTo: [StationKey.of('code-review')],
            search: StationSearchOverride.of({ enabled: false }),
          }),
          station('code-review', { ends: true }),
          completed(),
        ],
      }),
    );

    expect(error.message).toMatch(/no runs to improve/);
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('backlog'),
      rule: 'search',
    });
  });

  it('rejects a station search ceiling above the line’s monthly ceiling', () => {
    const error = errorOf(() =>
      plan({
        search: LineSearchPolicy.of({ monthlyCeiling: 20 }),
        stations: [
          backlog({ passesTo: [StationKey.of('code-review')] }),
          station('code-review', {
            ends: true,
            search: StationSearchOverride.of({ ceiling: 25 }),
          }),
          completed(),
        ],
      }),
    );

    expect(error.message).toMatch(/monthly_ceiling, 20 USD/);
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('code-review'),
      rule: 'search',
      setting: 'ceiling',
    });
  });

  it('checks a station’s search settings against the default policy when the line sets none', () => {
    const error = errorOf(() =>
      plan({
        stations: [
          backlog({ passesTo: [StationKey.of('code-review')] }),
          station('code-review', {
            ends: true,
            search: StationSearchOverride.of({ period: '1d' }),
          }),
          completed(),
        ],
      }),
    );

    expect(plan().search).toBeNull();
    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('code-review'),
      rule: 'search',
      setting: 'cooldown',
    });
  });

  it('rejects alerts where the line ends, since nothing runs there', () => {
    const error = errorOf(() =>
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

    expect(error.flaw).toEqual({
      in: 'station',
      station: StationKey.of('completed'),
      rule: 'alerts',
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
              minAgreement: 0.6,
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

  it('rejects work passing to a station nobody works', () => {
    expect(() =>
      plan({
        stations: [
          backlog({ passesTo: [StationKey.of('completed')] }),
          station('code-review'),
          completed(),
        ],
      }),
    ).toThrow(/must pass to work stations/);
  });

  it('rejects a word taking a task to a station it does not describe', () => {
    const error = errorOf(() =>
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

    expect(error.message).toMatch(/to a station on this line/);
    expect(error.flaw).toEqual({
      in: 'reaction',
      reaction: 0,
      rule: 'destination',
    });
  });

  it('rejects a word waiting at a station it does not describe', () => {
    const error = errorOf(() =>
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

    expect(error.message).toMatch(/at a station on this line/);
    expect(error.flaw).toEqual({ in: 'reaction', reaction: 0, rule: 'origin' });
  });

  it('rejects two stations waiting for the same word from the same place', () => {
    const error = errorOf(() =>
      plan({
        reactions: [
          { happening: MERGED, from: null, to: StationKey.of('code-review') },
          { happening: MERGED, from: null, to: StationKey.of('completed') },
        ],
      }),
    );

    expect(error.message).toMatch(/two wait for/);
    expect(error.flaw).toEqual({ in: 'reaction', reaction: 1, rule: 'claim' });
  });

  it('rejects repositories it could not work in', () => {
    const repository = LineRepositoryConfig.of(Repository.of('acme/api'));
    const error = errorOf(() =>
      plan({ repositories: [repository, repository] }),
    );

    expect(error.flaw).toEqual({ in: 'line', rule: 'repositories' });
  });

  it('rejects repositories that would run in different images', () => {
    const error = errorOf(() =>
      plan({
        repositories: [
          LineRepositoryConfig.of(Repository.of('acme/api'), {
            image: RunnerImage.of('ghcr.io/acme/api:1'),
          }),
          LineRepositoryConfig.of(Repository.of('acme/web'), {
            image: RunnerImage.of('ghcr.io/acme/web:1'),
          }),
        ],
      }),
    );

    expect(error.flaw).toEqual({ in: 'line', rule: 'repositories' });
  });

  it('rejects a station checking its layers while a repository says nothing of how its checkout is made ready', () => {
    const error = errorOf(() =>
      plan({
        stations: withStations(checking()),
        repositories: [
          repositoryConfig('acme/api', 'npm ci'),
          repositoryConfig('acme/web'),
        ],
      }),
    );

    expect(error.message).toMatch(/Station code-review checks its layers/);
    expect(error.message).toMatch(/acme\/web/);
    expect(error.flaw).toEqual({
      in: 'repository',
      repository: Repository.of('acme/web'),
      rule: 'setup',
    });
  });

  it('accepts a station checking its layers once every repository says how its checkout is made ready', () => {
    const parsed = plan({
      stations: withStations(checking()),
      repositories: [
        repositoryConfig('acme/api', 'npm ci'),
        repositoryConfig('acme/web', 'make'),
      ],
    });

    expect(
      parsed.repositories.entries.find(
        (each) => each.repository.value === 'acme/web',
      )?.setup?.value,
    ).toBe('make');
  });

  it('requires no setup of repositories when no station checks its layers', () => {
    expect(() =>
      plan({
        stations: withStations(checking({ diffs: false })),
        repositories: [repositoryConfig('acme/api')],
      }),
    ).not.toThrow();
    expect(() =>
      plan({
        stations: withStations(checking({ check: null })),
        repositories: [repositoryConfig('acme/api')],
      }),
    ).not.toThrow();
  });
});
