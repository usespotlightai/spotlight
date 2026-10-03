import { StationBlock } from '@replays/domain/value-objects/station-block.vo';

export interface StrongerModel {
  readonly model: string | null;
  readonly effort: string | null;
}

export interface OfferedChoices {
  readonly models: readonly string[];
  readonly efforts: readonly string[];
}

export interface StrongerProblem {
  readonly field: 'model' | 'effort';
  readonly reason: string;
}

const textOf = (held: unknown): string | null =>
  typeof held === 'string' ? held : null;

const listed = (choices: readonly string[]): string =>
  choices.length === 0 ? 'none yet' : choices.join(', ');

const modelProblems = (
  wanted: string | null,
  live: string | null,
  offer: OfferedChoices,
): readonly StrongerProblem[] =>
  wanted === null || wanted === live || offer.models.includes(wanted)
    ? []
    : [
        {
          field: 'model',
          reason: `is a model the station’s runners offer for its harness: ${listed(offer.models)}`,
        },
      ];

const effortProblems = (
  wanted: string | null,
  live: string | null,
  offer: OfferedChoices,
): readonly StrongerProblem[] => {
  if (wanted === null || wanted === live) {
    return [];
  }

  const above = live === null ? 0 : offer.efforts.indexOf(live);
  const higher = offer.efforts.slice(above + 1);

  return higher.includes(wanted)
    ? []
    : [
        {
          field: 'effort',
          reason: `is an effort its harness takes, higher than the live config’s ${live ?? `default, counted as its lowest, ${offer.efforts[0] ?? 'none'}`}: ${listed(higher)}`,
        },
      ];
};

export const strongerProblemsOf = (
  live: StationBlock,
  asked: StrongerModel,
  offer: OfferedChoices | null,
): readonly StrongerProblem[] => {
  const block = live.value;
  const liveModel = textOf(block.model);
  const liveEffort = textOf(block.effort);
  const changesModel = asked.model !== null && asked.model !== liveModel;
  const changesEffort = asked.effort !== null && asked.effort !== liveEffort;

  if (!changesModel && !changesEffort) {
    return [
      {
        field: 'model',
        reason:
          'names a model or a higher effort other than the live config’s, to check the set rewards it',
      },
    ];
  }
  if (!offer) {
    return [
      {
        field: 'model',
        reason: 'is replayed on a harness Spotlight knows',
      },
    ];
  }

  return [
    ...modelProblems(asked.model, liveModel, offer),
    ...effortProblems(asked.effort, liveEffort, offer),
  ];
};

export const strongerBlockOf = (
  live: StationBlock,
  asked: StrongerModel,
): StationBlock => {
  const block = live.value;

  return StationBlock.of({
    ...block,
    ...(asked.model === null ? {} : { model: asked.model }),
    ...(asked.effort === null ? {} : { effort: asked.effort }),
  });
};
