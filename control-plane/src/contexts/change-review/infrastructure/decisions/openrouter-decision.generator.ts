import type { DecisionGeneratorPort } from '@change-review/application/ports/decision-generator.port';
import type {
  ReasonedStep,
  RunReasoning,
} from '@change-review/application/ports/work.port';
import {
  DECISION_KINDS,
  type ProposedDecision,
} from '@change-review/domain/entities/decision.entity';
import { latestWithin } from '@platform/openrouter/latest-within';
import {
  type Fetch,
  JsonShape,
  requestJson,
} from '@platform/openrouter/openrouter-json';
import { z } from 'zod';

const MAX_OUTPUT = 8_000;

const MAX_STEP = 2_000;

const MAX_PROMPT_CHARS = 120_000;

const DECISIONS = new JsonShape(
  'decisions',
  z.object({
    decisions: z.array(
      z.object({
        kind: z.enum(DECISION_KINDS),
        title: z.string(),
        why: z.string(),
        alternatives: z.array(z.string()),
        paths: z.array(z.string()),
        steps: z.array(z.number().int()),
      }),
    ),
  }),
);

const SYSTEM = `You read how a coding agent reasoned while it changed a codebase, and pick out the decisions a reviewer of its pull request should know about. The diff shows what changed; you record why, and what the agent knowingly traded away or left undone.

Each decision is one of these kinds:

- "trade-off": the agent chose one approach at a known cost, such as simplicity over performance.
- "assumption": the agent relied on something being true that it did not verify, such as the shape of an input or how a caller behaves.
- "limitation": the agent left a known gap, edge case or shortcut in place.
- "rejected-approach": the agent considered an approach and chose against it. Name the approach in alternatives.
- "deviation": the agent departed from what it was told to do, or from the plan or spec it received.

Rules:

1. Record only decisions the agent's own words state or plainly imply. Its words are its messages, thoughts and plans, and the note it handed its work over with (a step of kind "handover", shown as the command it ran). Never infer one from what a good engineer would have considered, and never judge the code yourself.
2. Every decision cites in "steps" the numbers of the steps its reasoning appears in, as they appear in brackets. Never cite a step that does not say it.
3. Every decision names in "paths" the changed files it bears on, exactly as the list of changed files shows them, and never a file outside that list. The list covers every file changed on the task so far, including by earlier runs, so a decision to leave earlier work as it is bears on the file that work changed.
4. A title is a short plain statement of the decision ("Retries uploads in the request, not from a queue"). "why" says in one to three plain sentences what led to it and what it costs. "alternatives" names the options the agent weighed and set aside, and is empty when it weighed none.
5. Prefer a few decisions that matter to many that do not. Routine choices anyone would make are not decisions. When the agent made none worth a reviewer's attention, record none.

Order decisions by how much a reviewer needs to know them, deviations and limitations first.`;

const clipped = (text: string): string =>
  text.length > MAX_STEP ? `${text.slice(0, MAX_STEP)} …` : text;

const line = (step: ReasonedStep): string =>
  `[${step.index}] ${step.kind}: ${clipped(step.text.trim())}`;

export class OpenRouterDecisionGenerator implements DecisionGeneratorPort {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(
    reasoning: RunReasoning,
  ): Promise<readonly ProposedDecision[]> {
    if (!this.apiKey) {
      throw new Error('No OpenRouter API key is set for decisions');
    }

    const stepLines = latestWithin(reasoning.steps.map(line), MAX_PROMPT_CHARS);
    const prompt = [
      `The files changed on this task so far:\n${reasoning.changed.map((each) => `- ${each}`).join('\n')}`,
      stepLines.length < reasoning.steps.length
        ? `The agent's reasoning, step by step. Its earliest ${reasoning.steps.length - stepLines.length} steps are left out for length:`
        : "The agent's reasoning, step by step:",
      stepLines.join('\n'),
    ].join('\n\n');

    const {
      answer: { decisions },
    } = await requestJson({
      apiKey: this.apiKey,
      model: this.model,
      fetch: this.fetch,
      shape: DECISIONS,
      system: SYSTEM,
      prompt,
      max: MAX_OUTPUT,
    });

    return decisions;
  }
}
