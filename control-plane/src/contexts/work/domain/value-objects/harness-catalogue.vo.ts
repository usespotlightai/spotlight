import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { UnknownChatHarnessError } from '@work/domain/exceptions/unknown-chat-harness.error';

export class HarnessCatalogue {
  private constructor(private readonly harnesses: readonly HarnessId[]) {}

  static of(harnesses: readonly HarnessId[]): HarnessCatalogue {
    return new HarnessCatalogue([...harnesses]);
  }

  chosen(raw: string): HarnessId {
    const harness = this.harnesses.find((each) => each.value === raw.trim());

    if (!harness) {
      throw new UnknownChatHarnessError(raw);
    }

    return harness;
  }
}
