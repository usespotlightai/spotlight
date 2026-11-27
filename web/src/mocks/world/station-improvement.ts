import type { StationImprovementResponseDto } from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';

const UNMEASURED = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  oracle: null,
};

export const stationImprovement = (): StationImprovementResponseDto => ({
  set: {
    ...UNMEASURED,
    tasks: 3,
    fewestTasks: 5,
    bigEnough: false,
    fresh: null,
    minGain: 0.05,
  },
  scoring: { judge: true, check: false, scores: true },
  lastSearch: null,
  nextSearchAt: null,
  lastSkip: {
    reason: 'set-too-small',
    at: hoursAgo(4),
    text: 'The replay set has too few tasks. A search needs at least 5. Spotlight adds the station’s new runs to the set.',
    retryAt: hoursAgo(-20),
  },
});
