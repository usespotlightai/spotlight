import { InvalidAgentPromptError } from '@work/domain/exceptions/invalid-agent-prompt.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MAX_LENGTH = 20_000;

export class AgentPrompt {
  private constructor(readonly value: string) {}

  static of(written: string): AgentPrompt {
    return new AgentPrompt(
      WrittenText.prose(written, MAX_LENGTH, InvalidAgentPromptError),
    );
  }

  equals(other: AgentPrompt): boolean {
    return this.value === other.value;
  }
}
