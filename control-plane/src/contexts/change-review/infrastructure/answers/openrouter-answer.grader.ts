import { AnswerGradingError } from '@change-review/application/errors/answer-grading.error';
import type {
  AnswerGraderPort,
  GradedAnswer,
  GradingRequest,
} from '@change-review/application/ports/answer-grader.port';
import {
  ANSWER_VERDICTS,
  MAX_FEEDBACK,
} from '@change-review/domain/aggregates/question-answer.aggregate';
import {
  type Fetch,
  JsonSchema,
  OpenRouterEmptyCompletionError,
  OpenRouterRequestError,
  requestJson,
} from '@platform/openrouter/openrouter-json';
import { z } from 'zod';

const MAX_OUTPUT = 1_000;

const GRADE = new JsonSchema(
  'answer_grade',
  z.object({
    verdict: z.enum(ANSWER_VERDICTS),
    feedback: z.string(),
  }),
);

const SYSTEM = `You grade a code reviewer's answer to a question about a change they just reviewed. The question tests whether they understood the change. You get the question, the expected answer, the hunks of the diff that show the answer, and the reviewer's answer.

Give one verdict:

- "right": the answer has the meaning of the expected answer. Different words, more detail or a different order are fine.
- "partly-right": the answer has part of the meaning, or has it with a mistake that matters.
- "missed": the answer does not have the meaning, contradicts it, or says the reviewer does not know.

Judge meaning, not wording, spelling or style. When the hunks show that the expected answer is wrong, grade against the hunks.

Then write feedback to the reviewer, in the second person, in one or two short sentences:

- "right": add one fact from the hunks that the answer did not say, or leave the feedback empty when there is none worth saying.
- "partly-right": say what is right in a few words, then say exactly what is missing or wrong.
- "missed": say the correct answer in your own words.

Name code (functions, fields, files) exactly as the hunks show it. Use short, active sentences. Do not praise the reviewer, and do not repeat the question.`;

const described = (request: GradingRequest): string =>
  [
    `Question: ${request.question}`,
    `Expected answer: ${request.expected}`,
    'Hunks that show the answer:',
    ...request.cited.map((hunk) => `## ${hunk.path}\n${hunk.patch}`),
    `The reviewer's answer: ${request.reply}`,
  ].join('\n\n');

export class OpenRouterAnswerGrader implements AnswerGraderPort {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async grade(request: GradingRequest): Promise<GradedAnswer> {
    if (!this.apiKey) {
      throw new Error('No OpenRouter API key is set for grading answers');
    }

    const { answer, usage } = await requestJson({
      apiKey: this.apiKey,
      model: this.model,
      fetch: this.fetch,
      responseSchema: GRADE,
      system: SYSTEM,
      prompt: described(request),
      maxTokens: MAX_OUTPUT,
    }).catch((error: unknown) => {
      throw error instanceof OpenRouterRequestError ||
        error instanceof OpenRouterEmptyCompletionError
        ? new AnswerGradingError()
        : error;
    });

    return {
      grade: { ...answer, feedback: answer.feedback.slice(0, MAX_FEEDBACK) },
      usage,
    };
  }
}
