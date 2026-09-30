import { createContext, useContext } from 'react';
import type { FileChange, LineRange } from '@/lib/changes';

export interface ChangesPanel {
  readonly selected: FileChange | null;
  readonly lines: LineRange | null;
  open(file: FileChange, lines?: LineRange): void;
  close(): void;
}

const CLOSED: ChangesPanel = {
  selected: null,
  lines: null,
  open: () => {},
  close: () => {},
};

export const ChangesPanelContext = createContext<ChangesPanel>(CLOSED);

export const useChangesPanel = (): ChangesPanel =>
  useContext(ChangesPanelContext);
