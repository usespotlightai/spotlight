import { useConfiguration } from '@/hooks/api/useConfiguration';

export type MessageSource = {
  readonly integration: string;
  readonly name: string;
  readonly logo: string | null;
};

const codeHosts: Readonly<Record<string, string>> = { github: 'GitHub' };

export function useMessageSources(teamId: string | undefined) {
  const { data } = useConfiguration(teamId);
  const integrations = data?.integrations ?? [];

  return (source: string | null): MessageSource | null => {
    if (source === null) {
      return null;
    }

    const found = integrations.find((each) => each.integration === source);

    return {
      integration: source,
      name: found?.name ?? codeHosts[source] ?? source,
      logo: found?.logo ?? null,
    };
  };
}
