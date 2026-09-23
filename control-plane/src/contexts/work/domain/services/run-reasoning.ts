import type { StepKind } from '@work/domain/value-objects/step-kind';

export const HANDOVER_COMMAND = 'spotlight handover';

export type ReasoningKind = 'said' | 'thought' | 'planned' | 'handover';

const SPOKEN: Partial<Record<StepKind, ReasoningKind>> = {
  said: 'said',
  thought: 'thought',
  planned: 'planned',
};

const HANDING_OVER = new RegExp(
  `^\\s*${HANDOVER_COMMAND.split(' ').join('\\s+')}\\b`,
);

export const reasoningIn = (step: {
  readonly kind: StepKind;
  readonly text: string;
}): ReasoningKind | null => {
  if (!step.text.trim()) {
    return null;
  }

  if (step.kind === 'tool') {
    return HANDING_OVER.test(step.text) ? 'handover' : null;
  }

  return SPOKEN[step.kind] ?? null;
};
