import {
  asksQuestions,
  MAX_PROSE,
  MAX_QUESTIONS,
  type ProposedCohort,
  type ProposedLayer,
  type ProposedQuestion,
} from '@change-review/domain/value-objects/stack-cohort.vo';

export const shownHunks = (
  layers: readonly ProposedLayer[],
  upTo: number,
): Set<string> =>
  new Set(
    layers
      .slice(0, upTo + 1)
      .flatMap((each) => each.hunks.map((entry) => entry.hunk)),
  );

export const keptQuestions = (
  cohort: ProposedCohort,
  l: number,
): ProposedLayer['questions'] => {
  const layer = cohort.layers[l];

  if (!layer || !asksQuestions(cohort.kind)) {
    return [];
  }

  const shown = shownHunks(cohort.layers, l);

  return layer.questions
    .filter(
      (each) =>
        each.question.trim() &&
        each.question.length <= MAX_PROSE &&
        each.answer.trim() &&
        each.answer.length <= MAX_PROSE &&
        each.hunks.length > 0 &&
        each.hunks.every((hunk) => shown.has(hunk)),
    )
    .slice(0, MAX_QUESTIONS);
};

const questionKey = (question: ProposedQuestion): string =>
  JSON.stringify([question.question, question.answer, question.hunks]);

const shownQuestions = (cohort: ProposedCohort): Set<string> =>
  new Set(
    cohort.layers.flatMap((_, l) => keptQuestions(cohort, l).map(questionKey)),
  );

export const keepsEveryQuestion = (
  before: ProposedCohort,
  after: ProposedCohort,
): boolean => {
  const still = shownQuestions(after);

  return [...shownQuestions(before)].every((question) => still.has(question));
};
