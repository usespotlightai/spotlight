import { createContext, useContext } from 'react';

import type { CitedHunk } from '@/lib/judge';

export const MISSING_STEP = 'The step is no longer in the run’s journal.';

export const MISSING_FILE = 'The file is no longer in the run’s changes.';

export interface CitationTargets {
  step(index: number): (() => void) | null;
  hunk(hunk: CitedHunk): (() => void) | null;
}

export const NO_CITATION_TARGETS: CitationTargets = {
  step: () => null,
  hunk: () => null,
};

export const CitationTargetsContext =
  createContext<CitationTargets>(NO_CITATION_TARGETS);

export const useCitationTargets = (): CitationTargets =>
  useContext(CitationTargetsContext);
