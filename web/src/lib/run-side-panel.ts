import { createContext, type ReactNode, useContext } from 'react';
import type { FileChange, LineRange } from '@/lib/changes';

export interface MemoriesRun {
  readonly slug: string;
  readonly teamId: string;
  readonly runId: string;
}

export interface RunSidePanel {
  readonly selected: FileChange | null;
  readonly lines: LineRange | null;
  readonly memories: MemoriesRun | null;
  readonly sidePanel: ReactNode;
  open(file: FileChange, lines?: LineRange): void;
  openMemories(run: MemoriesRun): void;
  close(): void;
}

const CLOSED: RunSidePanel = {
  selected: null,
  lines: null,
  memories: null,
  sidePanel: null,
  open: () => {},
  openMemories: () => {},
  close: () => {},
};

export const RunSidePanelContext = createContext<RunSidePanel>(CLOSED);

export const useRunSidePanel = (): RunSidePanel =>
  useContext(RunSidePanelContext);
