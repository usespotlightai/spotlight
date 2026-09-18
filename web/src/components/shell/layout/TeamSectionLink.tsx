import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { type TeamSection, teamSectionPath } from '@/lib/team';

type TeamSectionLinkProps = {
  slug: string;
  teamId: string;
  section: TeamSection;
  active?: boolean;
};

export function TeamSectionLink({
  slug,
  teamId,
  section,
  active,
}: TeamSectionLinkProps) {
  return (
    <li>
      <SidebarLink
        to={teamSectionPath(slug, teamId, section.id)}
        icon={section.icon}
        className="pl-8"
        active={active}
      >
        {section.label}
      </SidebarLink>
    </li>
  );
}
