/** What a runner needs to know about a run to decide which comes first. */
export interface Queued {
  readonly priority: number;
  readonly createdAt: Date;
}

/**
 * The order work is handed out in: the station nearest the front of the line
 * first, and among equals the one that has waited longest. The claim itself
 * has to be one statement, so this is what that statement must mean.
 */
export const RunQueue = {
  before(one: Queued, other: Queued): number {
    return (
      other.priority - one.priority ||
      one.createdAt.getTime() - other.createdAt.getTime()
    );
  },
};
