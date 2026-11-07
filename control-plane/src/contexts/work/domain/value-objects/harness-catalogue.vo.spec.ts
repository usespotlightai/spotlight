import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { UnknownChatHarnessError } from '@work/domain/exceptions/unknown-chat-harness.error';
import { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';
import { describe, expect, it } from 'vitest';

const CATALOGUE = HarnessCatalogue.of([
  HarnessId.of('claude-code'),
  HarnessId.of('codex'),
]);

describe('HarnessCatalogue', () => {
  it('lets a chat start on a harness it lists', () => {
    expect(CATALOGUE.chosen('codex').equals(HarnessId.of('codex'))).toBe(true);
  });

  it('refuses a harness it does not list', () => {
    expect(() => CATALOGUE.chosen('cursor')).toThrow(UnknownChatHarnessError);
  });
});
