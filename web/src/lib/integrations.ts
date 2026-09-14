import type {
  ConfiguredIntegrationResponseDto,
  KnownIntegrationResponseDto,
} from '@/lib/api';

export interface Shown {
  readonly source: string;
  readonly name: string;
  readonly summary: string;
  readonly integration: ConfiguredIntegrationResponseDto | null;
}

export const shownTogether = (
  starters: readonly KnownIntegrationResponseDto[],
  installed: readonly ConfiguredIntegrationResponseDto[],
): Shown[] => {
  const written = new Map(installed.map((each) => [each.source, each]));

  const known = starters.map((starter) => ({
    source: starter.source,
    name: starter.name,
    summary: starter.summary,
    integration: written.get(starter.source) ?? null,
  }));

  const theirs = installed
    .filter(
      (each) => !starters.some((starter) => starter.source === each.source),
    )
    .map((each) => ({
      source: each.source,
      name: each.name,
      summary: 'Written by hand in this team’s configuration.',
      integration: each,
    }));

  return [...known, ...theirs];
};
