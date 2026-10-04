import { MousePointer2 } from 'lucide-react';
import { PillLink } from '@/components/shared/PillLink';
import type { ImprovedStation } from '@/lib/chat';
import { teamSectionPath } from '@/lib/team';

type ImproveStationLinkProps = {
  slug: string;
  teamId: string;
  improving: ImprovedStation;
  className?: string;
};

export function ImproveStationLink({
  slug,
  teamId,
  improving,
  className,
}: ImproveStationLinkProps) {
  return (
    <PillLink
      to={teamSectionPath(slug, teamId, 'agent')}
      state={{ improving }}
      className={className}
    >
      <MousePointer2 aria-hidden />
      Improve this station
    </PillLink>
  );
}
