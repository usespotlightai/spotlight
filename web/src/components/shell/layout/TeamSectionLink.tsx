import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { TEAM_SECTIONS, type TeamSectionId, teamSectionPath } from '@/lib/team';

type TeamSectionLinkProps = {
  slug: string;
  teamId: string;
  section: TeamSectionId;
};

export function TeamSectionLink({
  slug,
  teamId,
  section,
}: TeamSectionLinkProps) {
  const { label, icon } = TEAM_SECTIONS[section];

  return (
    <li>
      <SidebarLink
        to={teamSectionPath(slug, teamId, section)}
        icon={icon}
        className="pl-8"
      >
        {label}
      </SidebarLink>
    </li>
  );
}
