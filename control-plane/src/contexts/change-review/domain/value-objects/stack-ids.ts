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

const named = <T extends string>(
  raw: string,
  shape: RegExp,
  what: string,
): T => {
  if (!shape.test(raw)) {
    throw InvalidChangeStackError.because(
      `${what} name ${raw || 'nothing'} is not valid`,
    );
  }

  return raw as T;
};

export const HunkId = {
  at: (place: number): HunkId => `h${placed(place, 'hunks')}` as HunkId,
  of: (raw: string): HunkId => named<HunkId>(raw, HUNK, 'hunk'),
  parsed: (raw: string): HunkId | null =>
    HUNK.test(raw) ? (raw as HunkId) : null,
};

export const CohortId = {
  at: (place: number): CohortId => `c${placed(place, 'cohorts')}` as CohortId,
  of: (raw: string): CohortId => named<CohortId>(raw, COHORT, 'cohort'),
};

export const LayerId = {
  in: (cohort: CohortId, place: number): LayerId =>
    `${cohort}.l${placed(place, 'layers')}` as LayerId,
  of: (raw: string): LayerId => named<LayerId>(raw, LAYER, 'layer'),
  cohortOf: (id: LayerId): CohortId => CohortId.of(id.split('.')[0] ?? ''),
};

export const QuestionId = {
  in: (layer: LayerId, place: number): QuestionId =>
    `${layer}.q${placed(place, 'questions')}` as QuestionId,
  of: (raw: string): QuestionId => named<QuestionId>(raw, QUESTION, 'question'),
  parsed: (raw: string): QuestionId | null =>
    QUESTION.test(raw) ? (raw as QuestionId) : null,
};
