import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';

declare const hunkBrand: unique symbol;
declare const cohortBrand: unique symbol;
declare const layerBrand: unique symbol;
declare const questionBrand: unique symbol;

export type HunkId = string & { readonly [hunkBrand]: true };

export type CohortId = string & { readonly [cohortBrand]: true };

export type LayerId = string & { readonly [layerBrand]: true };

export type QuestionId = string & { readonly [questionBrand]: true };

const PLACE = '[1-9][0-9]*';

const HUNK = new RegExp(`^h${PLACE}$`);

const COHORT = new RegExp(`^c${PLACE}$`);

const LAYER = new RegExp(`^c${PLACE}\\.l${PLACE}$`);

const QUESTION = new RegExp(`^c${PLACE}\\.l${PLACE}\\.q${PLACE}$`);

const placed = (place: number, what: string): number => {
  if (!Number.isInteger(place) || place < 1) {
    throw InvalidChangeStackError.because(`must number its ${what} from 1`);
  }

  return place;
};

const isHunkId = (raw: string): raw is HunkId => HUNK.test(raw);

const isCohortId = (raw: string): raw is CohortId => COHORT.test(raw);

const isLayerId = (raw: string): raw is LayerId => LAYER.test(raw);

const isQuestionId = (raw: string): raw is QuestionId => QUESTION.test(raw);

const named = <T extends string>(
  raw: string,
  shaped: (raw: string) => raw is T,
  what: string,
): T => {
  if (!shaped(raw)) {
    throw InvalidChangeStackError.because(
      `${what} name ${raw || 'nothing'} is not valid`,
    );
  }

  return raw;
};

export const HunkId = {
  at: (place: number): HunkId =>
    named(`h${placed(place, 'hunks')}`, isHunkId, 'hunk'),
  of: (raw: string): HunkId => named(raw, isHunkId, 'hunk'),
  parsed: (raw: string): HunkId | null => (isHunkId(raw) ? raw : null),
};

export const CohortId = {
  at: (place: number): CohortId =>
    named(`c${placed(place, 'cohorts')}`, isCohortId, 'cohort'),
  of: (raw: string): CohortId => named(raw, isCohortId, 'cohort'),
};

export const LayerId = {
  in: (cohort: CohortId, place: number): LayerId =>
    named(`${cohort}.l${placed(place, 'layers')}`, isLayerId, 'layer'),
  of: (raw: string): LayerId => named(raw, isLayerId, 'layer'),
  cohortOf: (id: LayerId): CohortId => CohortId.of(id.split('.')[0] ?? ''),
};

export const QuestionId = {
  in: (layer: LayerId, place: number): QuestionId =>
    named(`${layer}.q${placed(place, 'questions')}`, isQuestionId, 'question'),
  of: (raw: string): QuestionId => named(raw, isQuestionId, 'question'),
  parsed: (raw: string): QuestionId | null => (isQuestionId(raw) ? raw : null),
};
