import type {
  ConfiguredIntegrationResponseDto,
  KnownToolResponseDto,
} from '@/lib/api';

/** One host as the page shows it, whether or not it is written down yet. */
export interface Shown {
  readonly source: string;
  readonly name: string;
  readonly summary: string;
  /** What the team's own configuration says, where it says anything. */
  readonly integration: ConfiguredIntegrationResponseDto | null;
}

/**
 * Every host on one page: the ones this team has written down, and the ones
 * it could. A team's own file wins where both know a source, because that is
 * what is actually listening.
 */
export const shownTogether = (
  tools: readonly KnownToolResponseDto[],
  installed: readonly ConfiguredIntegrationResponseDto[],
): Shown[] => {
  const written = new Map(installed.map((each) => [each.source, each]));

  const known = tools.map((tool) => ({
    source: tool.source,
    name: tool.name,
    summary: tool.summary,
    integration: written.get(tool.source) ?? null,
  }));

  // Anything written by hand belongs here too, or a team cannot see what it
  // is running, let alone take it away.
  const theirs = installed
    .filter((each) => !tools.some((tool) => tool.source === each.source))
    .map((each) => ({
      source: each.source,
      name: each.name,
      summary: 'Written by hand in this team’s configuration.',
      integration: each,
    }));

  return [...known, ...theirs];
};
