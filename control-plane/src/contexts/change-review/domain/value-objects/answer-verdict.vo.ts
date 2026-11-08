export const ANSWER_VERDICTS = ['right', 'partly-right', 'missed'] as const;

export type AnswerVerdict = (typeof ANSWER_VERDICTS)[number];
