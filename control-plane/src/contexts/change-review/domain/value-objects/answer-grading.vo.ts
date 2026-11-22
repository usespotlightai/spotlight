export const ANSWER_GRADINGS = ['pending', 'graded', 'failed'] as const;

/** Where grading an answer stands: an answer in words waits for its grade, and an answer of "I don't know" needs none. */
export type AnswerGrading = (typeof ANSWER_GRADINGS)[number];
