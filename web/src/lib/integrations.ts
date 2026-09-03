export const integrationsPath = (slug: string, teamId: string) =>
  `/w/${slug}/team/${teamId}/integrations`;

/** A team has something to fix where any of its files would not read. */
export const hasProblems = (
  configuration: { problems: readonly unknown[] } | undefined,
): boolean => (configuration?.problems.length ?? 0) > 0;
