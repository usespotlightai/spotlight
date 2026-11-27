import type { Reasoning } from '@work/domain/services/run-reasoning';

/** How a person reads a step of reasoning: the spotlight command it ran alone, without the rest of the script. */
export const reasoningTextOf = (reasoning: Reasoning): string =>
  reasoning.commands[0]?.shown ?? reasoning.text;
