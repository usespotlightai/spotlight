/**
 * One entry in a run's journal, as the runner wrote it down and the database
 * holds it.
 *
 * Kept apart from anything that reads it: the agent's own updates and whatever
 * a harness reports about itself arrive as entries alike, and neither of those
 * vocabularies belongs to the other.
 */
export interface Journalled {
  readonly type: string;
  readonly at: Date;
  /**
   * A hook's name. Set only for the deployment's own output, which is what
   * tells it apart from anything the agent said.
   */
  readonly message: string | null;
  readonly data: string | null;
}

/** Base64 over the wire: not everything a runner is given is a string. */
export const decoded = (data: string): string =>
  Buffer.from(data, 'base64').toString('utf8');
