import type { Reasoning } from '@work/domain/services/run-reasoning';

const COMMAND_ENDS = new Set(['\n', '|', ';', '&', '>', '<', '`']);

const invocationFrom = (shell: string, start: number): string => {
  let quote: string | null = null;
  let at = start;

  for (; at < shell.length; at += 1) {
    const char = shell.charAt(at);

    if (char === '\\' && quote !== "'") {
      at += 1;
    } else if (quote) {
      quote = char === quote ? null : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (COMMAND_ENDS.has(char)) {
      break;
    }
  }

  const invocation = shell.slice(start, at).replaceAll('\\\n', ' ');

  return (
    /[<>]/.test(shell.charAt(at))
      ? invocation.replace(/\s\d+\s*$/, '')
      : invocation
  ).trim();
};

/** How a person reads a step of reasoning: a spotlight command alone, without the rest of the script it ran in. */
export const reasoningTextOf = (reasoning: Reasoning): string =>
  reasoning.commandAt === null
    ? reasoning.text
    : invocationFrom(reasoning.text, reasoning.commandAt);
