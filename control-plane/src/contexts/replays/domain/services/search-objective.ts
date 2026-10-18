import type { SetHealth } from '@replays/domain/services/set-health';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';

export const objectiveFor = (
  requested: SearchObjective | null,
  health: SetHealth,
): SearchObjective =>
  requested ?? (health.saturation?.saturated ? 'cost' : 'success');
