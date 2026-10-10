import { Package } from 'lucide-react';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';
import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import { useCollapsed } from '@/hooks/useCollapsed';
import type { LineResponseDto } from '@/lib/api';
import { linePath } from '@/lib/team';

const LINES_STORAGE_KEY = 'spotlight.collapsed-lines';

type TeamLinesProps = {
  slug: string;
  teamId: string;
  lines: readonly LineResponseDto[] | undefined;
  shownLineId: string | undefined;
};

export function TeamLines({
  slug,
  teamId,
  lines,
  shownLineId,
}: TeamLinesProps) {
  const { isExpanded, toggle } = useCollapsed(LINES_STORAGE_KEY);
  const open = isExpanded(teamId);

  return (
    <li>
      <DisclosureRow
        label="Lines"
        icon={Package}
        open={open}
        onToggle={() => toggle(teamId)}
        className="pl-8"
      />

      <Disclosure open={open} slot="lines" label="Lines">
        {lines?.map((line) => (
          <li key={line.id}>
            <SidebarLink
              to={linePath(slug, teamId, line.id)}
              className="pl-14"
              active={line.id === shownLineId}
            >
              {line.name}
            </SidebarLink>
          </li>
        ))}
      </Disclosure>
    </li>
  );
}
