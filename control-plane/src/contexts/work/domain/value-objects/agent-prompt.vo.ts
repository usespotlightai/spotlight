import { InvalidAgentPromptError } from '@work/domain/exceptions/invalid-agent-prompt.error';

const MAX_LENGTH = 20_000;

export class AgentPrompt {
  private constructor(readonly value: string) {}

  static of(raw: string): AgentPrompt {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidAgentPromptError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidAgentPromptError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new AgentPrompt(trimmed);
  }

  equals(other: AgentPrompt): boolean {
    return this.value === other.value;
  }
}
