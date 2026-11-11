import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';

export const generationToShow = (
  shown: number,
  stored: number,
): number | null => DraftGeneration.of(stored).correcting(shown)?.value ?? null;
