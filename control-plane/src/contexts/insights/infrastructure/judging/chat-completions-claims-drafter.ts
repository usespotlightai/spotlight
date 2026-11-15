import type {
  ClaimsDrafterPort,
  ClaimsDraftRequest,
} from '@insights/application/ports/claims-drafter.port';
import {
  type Fetch,
  JsonSchema,
  type ModelEndpoint,
  requestJson,
} from '@platform/llm/chat-completions';
import {
  MAX_CLAIM_LENGTH,
  MAX_CLAIMS,
} from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { z } from 'zod';

const MAX_OUTPUT = 8_000;

const DRAFTS = new JsonSchema(
  'claims_drafts',
  z.object({
    candidates: z.array(
      z.object({
        claims: z.array(z.string()),
        why: z.string(),
      }),
    ),
  }),
);

const systemOf = (request: ClaimsDraftRequest): string =>
  [
    'You revise the claims of a judge. The judge reads the journal and the diff of an agent run and decides for each claim if the run meets it.',
    `A run passes when the share of met claims is at least ${request.passThreshold}.`,
    'People disagreed with the judge on the cases you get. Each case shows what the judge decided per claim, its reasons, and what the person answered.',
    '"claim-wrong" means the claim does not fit that run. "judge-right" means the judge read the claim correctly. An answer\'s note says why the person answered that claim so. A note on a passed run says what was wrong that no claim caught.',
    `Write at most ${request.maxCandidates} different claim lists that would agree better with the people. Each list has 1 to ${MAX_CLAIMS} claims; each claim has at most ${MAX_CLAIM_LENGTH} characters.`,
    'Each claim is one thing a reviewer can check from the journal and the diff alone. Keep the claims that work. Change, remove or add only what the cases show.',
  ].join('\n');

const promptOf = (request: ClaimsDraftRequest): string =>
  JSON.stringify({
    claims: request.claims.map((text, index) => ({ index, text })),
    cases: request.cases.map((each) => ({
      judge: each.direction === 'judge-failed' ? 'failed' : 'passed',
      claims: each.claimResults.map((met, index) => ({ index, met })),
      reasons: each.reasons,
      answers: each.answers,
      note: each.note,
      should_have_failed: each.shouldHaveFailed,
    })),
  });

export class ChatCompletionsClaimsDrafter implements ClaimsDrafterPort {
  constructor(
    private readonly endpoint: ModelEndpoint | null,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  get available(): boolean {
    return this.endpoint !== null;
  }

  async drafted(
    request: ClaimsDraftRequest,
  ): Promise<readonly (readonly string[])[]> {
    if (!this.endpoint) {
      return [];
    }

    const { answer } = await requestJson({
      endpoint: this.endpoint,
      fetch: this.fetch,
      system: systemOf(request),
      prompt: promptOf(request),
      maxTokens: MAX_OUTPUT,
      responseSchema: DRAFTS,
    });

    return answer.candidates
      .slice(0, request.maxCandidates)
      .map((each) => each.claims);
  }
}
