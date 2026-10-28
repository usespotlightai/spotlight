import {
  CircleCheck,
  CircleDashed,
  CircleOff,
  Clock,
  GitPullRequestArrow,
  Info,
  ListChecks,
  type LucideIcon,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { StationImprovementSkeleton } from '@/components/features/stations/overview/StationImprovementSkeleton';
import { PillButton } from '@/components/shared/PillButton';
import { SECTION_LINK } from '@/components/shared/section-link';
import { TooltipNoteContent } from '@/components/shared/TooltipNoteContent';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useStationImprovement } from '@/hooks/api/useStationImprovement';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation } from '@/lib/replay';
import {
  type ImprovementFact,
  type ImprovementStatus,
  improvementFact,
  improvementLinks,
  improvementNote,
} from '@/lib/station-improvement';
import { cn } from '@/lib/utils';

const ICONS: Record<ImprovementStatus, LucideIcon> = {
  searching: Sparkles,
  picking: ListChecks,
  'pull-request-open': GitPullRequestArrow,
  improved: CircleCheck,
  'not-improving': TriangleAlert,
  waiting: Clock,
  off: CircleOff,
  'not-started': CircleDashed,
};

function FactText({ fact }: { fact: ImprovementFact }) {
  if (fact.link?.kind === 'page') {
    return (
      <TrailLink to={fact.link.to} className={SECTION_LINK}>
        {fact.label}
      </TrailLink>
    );
  }
  if (fact.link?.kind === 'external') {
    return (
      <a
        href={fact.link.href}
        target="_blank"
        rel="noreferrer"
        className={SECTION_LINK}
      >
        {fact.label}
      </a>
    );
  }

  return <span className="text-muted-foreground text-xs">{fact.label}</span>;
}

export function StationImprovement({ at }: { at: ReplayedStation }) {
  const improvement = useStationImprovement(at.teamId, at.lineId, at.stationId);

  if (loading(improvement)) {
    return (
      <span role="status" aria-label="Loading the improvement status">
        <StationImprovementSkeleton />
      </span>
    );
  }

  if (failed(improvement) || !improvement.data) {
    return (
      <span
        role="alert"
        className="flex items-center gap-2 text-muted-foreground text-xs"
      >
        Status unavailable
        <PillButton
          onClick={() => void improvement.refetch()}
          disabled={improvement.isFetching}
        >
          Try again
        </PillButton>
      </span>
    );
  }

  const { status } = improvement.data;
  const Icon = ICONS[status];
  const links = improvementLinks(at, improvement.data);

  return (
    <div
      data-slot="station-improvement"
      data-status={status}
      className="flex min-w-0 items-center gap-1.5"
    >
      <Icon
        aria-hidden
        className={cn(
          'size-3.5 shrink-0',
          status === 'not-improving'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground',
        )}
      />
      <FactText fact={improvementFact(at, improvement.data)} />
      <Popover>
        <PopoverTrigger
          openOnHover
          aria-label="Improvement detail"
          className="inline-flex rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Info aria-hidden className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="flex max-w-xs flex-col gap-1 px-2 py-1 text-xs leading-5"
        >
          <TooltipNoteContent note={improvementNote(improvement.data)} />
          {links.length > 0 && (
            <span className="flex gap-3 pb-1">
              {links.map((link) => (
                <TrailLink
                  key={link.label}
                  to={link.to}
                  className="rounded-sm text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {link.label}
                </TrailLink>
              ))}
            </span>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
