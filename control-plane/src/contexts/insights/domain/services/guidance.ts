import type { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import { judgeGuidanceOf } from '@shared-kernel/domain/value-objects/judge-guidance';

const NGRAM_SIZE = 5;

const MIN_SENTENCE_WORDS = 3;

const NUMBERED_CLAIM =
  /\b(?:claims?|criteri(?:on|a)|items?|points?|requirements?)\s*(?:no\.?|number|#)?\s*\d+|#\s*\d+|\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last)\s+(?:claim|criterion|item|point|requirement)/i;

const wordsOf = (text: string): readonly string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

const sentencesOf = (text: string): readonly string[] =>
  text
    .split(/[\r\n]+|[.!?;](?=\s|$)/)
    .map((each) => wordsOf(each))
    .filter((words) => words.length >= MIN_SENTENCE_WORDS)
    .map((words) => ` ${words.join(' ')} `);

const ngramsOf = (text: string): readonly string[] => {
  const words = wordsOf(text);

  return Array.from(
    { length: Math.max(0, words.length - NGRAM_SIZE + 1) },
    (_, at) => words.slice(at, at + NGRAM_SIZE).join(' '),
  );
};

export const guardedGuidanceOf = (
  guidance: string | null,
  criteria: JudgeCriteria,
): string | null => {
  const text = judgeGuidanceOf(guidance);

  if (!text || NUMBERED_CLAIM.test(text)) {
    return null;
  }

  const texts = [criteria.rubric ?? '', ...criteria.claims];
  const criteriaNgrams = new Set(texts.flatMap(ngramsOf));
  const spaced = ` ${wordsOf(text).join(' ')} `;
  const leaksCriteria =
    ngramsOf(text).some((each) => criteriaNgrams.has(each)) ||
    texts.flatMap(sentencesOf).some((sentence) => spaced.includes(sentence));

  return leaksCriteria ? null : text;
};
