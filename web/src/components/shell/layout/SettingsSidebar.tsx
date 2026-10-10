import {
  ChevronLeft,
  KeyRound,
  type LucideIcon,
  Server,
  Settings2,
  SquareMousePointer,
  Webhook,
} from 'lucide-react';
import { Link } from 'react-router';
import { SettingsNavGroup } from '@/components/shell/layout/SettingsNavGroup';
import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { useRunners } from '@/hooks/api/useRunners';
import { administers, type Role } from '@/lib/role';
import { answeringCount, runnersPath } from '@/lib/runner';
import {
  TEAM_SETTINGS_PAGES,
  type TeamSettingsPageId,
  teamSettingsPath,
  workspaceGeneralPath,
} from '@/lib/settings';
import type { Team } from '@/lib/team';
import { tokensPath } from '@/lib/token';

const TEAM_SETTINGS_ICONS: Record<TeamSettingsPageId, LucideIcon> = {
  general: Settings2,
  integrations: Webhook,
  skills: SquareMousePointer,
};

type SettingsSidebarProps = {
  slug: string;
  back: string;
  workspace: {
    readonly role: Role;
    readonly teams: readonly Team[];
  };
};

export function SettingsSidebar({
  slug,
  back,
  workspace,
}: SettingsSidebarProps) {
  const { data: fleet } = useRunners(slug);

  return (
    <>
      <div className="flex h-12 shrink-0 items-center">
        <Link
          to={back}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2 font-medium text-foreground text-sm outline-none transition-colors hover:bg-border/50"
        >
          <ChevronLeft
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          Back to app
        </Link>
      </div>

      <nav
        aria-label="Settings"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2"
      >
        <SettingsNavGroup heading="Workspace">
          <li>
            <SidebarLink to={workspaceGeneralPath(slug)} icon={Settings2}>
              General
            </SidebarLink>
          </li>
          <li>
            <SidebarLink
              to={runnersPath(slug)}
              icon={Server}
              trailing={
                <p className="text-xs">{fleet && answeringCount(fleet)}</p>
              }
            >
              Runners
            </SidebarLink>
          </li>
          {administers(workspace.role) && (
            <li>
              <SidebarLink to={tokensPath(slug)} icon={KeyRound}>
                Tokens
              </SidebarLink>
            </li>
          )}
        </SettingsNavGroup>

        {workspace.teams.map((team) => (
          <SettingsNavGroup key={team.id} heading={team.name}>
            {TEAM_SETTINGS_PAGES.map((page) => (
              <li key={page.id}>
                <SidebarLink
                  to={teamSettingsPath(slug, team.id, page.id)}
                  icon={TEAM_SETTINGS_ICONS[page.id]}
                >
                  {page.label}
                </SidebarLink>
              </li>
            ))}
          </SettingsNavGroup>
        ))}
      </nav>
    </>
  );
}
