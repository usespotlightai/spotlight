import { createContext, useContext } from 'react';
import type { FileChange, LineRange } from '@/lib/changes';

export interface RememberedRun {
  readonly slug: string;
  readonly teamId: string;
  readonly runId: string;
}

export interface RunSidePanel {
  readonly selected: FileChange | null;
  readonly lines: LineRange | null;
  readonly remembered: RememberedRun | null;
  open(file: FileChange, lines?: LineRange): void;
  openRemembered(run: RememberedRun): void;
  close(): void;
}

const CLOSED: RunSidePanel = {
  selected: null,
  lines: null,
  remembered: null,
  open: () => {},
  openRemembered: () => {},
  close: () => {},
};

export const RunSidePanelContext = createContext<RunSidePanel>(CLOSED);

export const useRunSidePanel = (): RunSidePanel =>
  useContext(RunSidePanelContext);
