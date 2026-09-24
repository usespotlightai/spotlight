import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { Continuity } from '@work/domain/value-objects/continuity.vo';

export const pinnedRunner = async (
  continuity: Continuity,
  placement: RunnerPlacement,
  runners: RunnerPresencePort,
): Promise<RunnerId | null> => {
  const terms = continuity.pinnedTo
    ? await runners.pinnableTerms(continuity.pinnedTo)
    : null;

  return terms ? continuity.pinnedWithin(placement, terms) : null;
};
