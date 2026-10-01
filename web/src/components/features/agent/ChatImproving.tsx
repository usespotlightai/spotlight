import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ImprovedStation } from '@/lib/chat';
import { stationPath } from '@/lib/station';

type ChatImprovingProps = {
  slug: string;
  teamId: string;
  improving: ImprovedStation;
};

export function ChatImproving({ slug, teamId, improving }: ChatImprovingProps) {
  return (
    <p className="mt-2 text-center text-muted-foreground text-xs">
      Improving{' '}
      <TrailLink
        to={stationPath(slug, teamId, improving.lineId, improving.stationId)}
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {improving.stationName}
      </TrailLink>{' '}
      on {improving.lineName}
    </p>
  );
}
