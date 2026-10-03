import { Package } from 'lucide-react';
import { useId } from 'react';
import { SidebarLink } from '@/components/shell/layout/SidebarLink';
import type { LineResponseDto } from '@/lib/api';
import { linePath } from '@/lib/team';

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
  const labelId = useId();

  return (
    <li>
      <p
        id={labelId}
        className="flex h-7 items-center gap-2 pr-2 pl-8 text-muted-foreground text-sm"
      >
        <Package className="size-3.5 shrink-0" aria-hidden />
        Lines
      </p>

      <ul
        data-slot="lines"
        aria-labelledby={labelId}
        className="flex flex-col gap-0.5 pt-0.5"
      >
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
      </ul>
    </li>
  );
}
