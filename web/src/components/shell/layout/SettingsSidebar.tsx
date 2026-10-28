import {
  ChevronLeft,
  KeyRound,
  type LucideIcon,
  Server,
  Settings2,
  SquareMousePointer,
  Users,
  Webhook,
} from 'lucide-react';
import { Link } from 'react-router';
import { SettingsNavGroup } from '@/components/shell/layout/SettingsNavGroup';
import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRunners } from '@/hooks/api/useRunners';
import { membersPath } from '@/lib/members';
import { isAdmin, type Role } from '@/lib/role';
import { onlineCount, runnersPath } from '@/lib/runner';
import {
  apiAccessPath,
  TEAM_SETTINGS_PAGES,
  type TeamSettingsPageId,
  teamSettingsPath,
  workspaceGeneralPath,
} from '@/lib/settings';
import type { Team } from '@/lib/team';

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

      <ScrollArea className="min-h-0 flex-1">
        <nav
          aria-label="Settings"
          className="min-h-full flex flex-col gap-4 pt-2"
        >
          <SettingsNavGroup heading="Workspace">
            <li>
              <SidebarLink to={workspaceGeneralPath(slug)} icon={Settings2}>
                General
              </SidebarLink>
            </li>
            {isAdmin(workspace.role) && (
              <li>
                <SidebarLink to={membersPath(slug)} icon={Users}>
                  Members
                </SidebarLink>
              </li>
            )}
            <li>
              <SidebarLink
                to={runnersPath(slug)}
                icon={Server}
                trailing={
                  <p className="text-xs">{fleet && onlineCount(fleet)}</p>
                }
              >
                Runners
              </SidebarLink>
            </li>
            {isAdmin(workspace.role) && (
              <li>
                <SidebarLink to={apiAccessPath(slug)} icon={KeyRound}>
                  API access
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
      </ScrollArea>
    </>
  );
}
