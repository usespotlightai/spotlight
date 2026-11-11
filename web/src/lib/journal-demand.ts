import { createContext } from 'react';

import type { JournalledRun } from '@/lib/inbox';

export type JournalDemand = {
  readonly runs: readonly JournalledRun[];
  readonly want: (runIds: readonly string[]) => void;
};

export const JournalDemandContext = createContext<JournalDemand>({
  runs: [],
  want: () => {},
});
