export const STARTER_TOOLS = Symbol('STARTER_TOOLS');

/**
 * A host Spotlight can write a starting configuration file for. What each host
 * is and how to talk to it is infrastructure's to know; the application asks
 * only for the catalogue to show and the file to write.
 */
export interface StarterTool {
  readonly source: string;
  readonly name: string;
  readonly summary: string;
  readonly secretCalled: string;
}

export interface StarterToolsPort {
  /** Every host with a starter file, for describing what a team may listen to. */
  all(): readonly StarterTool[];
  /** The starting configuration for a host, or null where none is known. */
  fileFor(source: string): string | null;
}
