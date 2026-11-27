import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useMessageSources } from '@/hooks/api/useMessageSources';
import { teamSettingsPath } from '@/lib/settings';

type TaskSourceLinkProps = {
  slug: string;
  teamId: string;
  source: string | null;
};

export function TaskSourceLink({ slug, teamId, source }: TaskSourceLinkProps) {
  const from = useMessageSources(teamId)(source);

  if (!from) {
    return null;
  }

  return (
    <TrailLink
      to={teamSettingsPath(slug, teamId, 'integrations')}
      className="flex h-7 pointer-coarse:h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent"
    >
      <IntegrationLogo logo={from.logo} name="" className="size-4" />

      <span className="truncate text-foreground">{from.name}</span>
    </TrailLink>
  );
}
