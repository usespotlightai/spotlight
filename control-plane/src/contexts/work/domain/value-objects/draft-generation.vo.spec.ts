import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { describe, expect, it } from 'vitest';

describe('DraftGeneration', () => {
  it('corrects a shared document that shows an older generation than the sent draft', () => {
    expect(DraftGeneration.of(3).correcting(2)?.value).toBe(3);
  });

  it('leaves a document that shows the sent generation or a later one', () => {
    expect(DraftGeneration.of(3).correcting(3)).toBeNull();
    expect(DraftGeneration.of(3).correcting(4)).toBeNull();
  });

  it('corrects a document whose generation is not a whole number', () => {
    expect(DraftGeneration.of(1).correcting(0.5)?.value).toBe(1);
  });

  it('moves on to the next generation', () => {
    expect(DraftGeneration.first().next().value).toBe(1);
  });
});
