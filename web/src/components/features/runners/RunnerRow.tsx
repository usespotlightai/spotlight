import { CornerDownRight } from 'lucide-react';
import {
  HOST_COLUMNS,
  HOST_ROW,
  HOST_ROW_HOVER,
} from '@/components/features/runners/columns';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import { HiddenRunTitle } from '@/components/features/runners/HiddenRunTitle';
import { ImagePill } from '@/components/features/runners/ImagePill';
import { StandingDot } from '@/components/features/runners/StandingDot';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  type ActiveRunner,
  formatRun,
  harnessesOf,
  hiddenFromViewer,
  hiddenRunTip,
  leasedRunPath,
  type NamedHarness,
  runnerStanding,
} from '@/lib/runner';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

type RunnerRowProps = {
  slug: string;
  runner: ActiveRunner;
  harnesses: readonly NamedHarness[] | undefined;
};

export function RunnerRow({ slug, runner, harnesses }: RunnerRowProps) {
  const label = formatRun(runner.currentRun);
  const path = leasedRunPath(slug, runner.currentRun);

  return (
    <li
      data-slot="runner-row"
      className={cn(HOST_ROW, HOST_ROW_HOVER, HOST_COLUMNS)}
    >
      <span className="col-span-2 flex min-w-0 items-center gap-1.5 pl-1">
        <CornerDownRight aria-hidden className="size-3.5 shrink-0 text-faint" />
        {path ? (
          <TrailLink
            to={path}
            title={label}
            className="truncate rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {label}
          </TrailLink>
        ) : runner.currentRun && hiddenFromViewer(runner.currentRun) ? (
          <HiddenRunTitle tip={hiddenRunTip(runner.currentRun)} />
        ) : (
          <span title={label} className="truncate text-muted-foreground">
            {label}
          </span>
        )}
      </span>

      <StandingDot tone={runner.currentRun ? 'busy' : 'ready'}>
        {runnerStanding(runner)}
      </StandingDot>

      <span className="flex min-w-0">
        {runner.image && (
          <ImagePill image={runner.image} title={runner.image} />
        )}
      </span>

      <HarnessLogos harnesses={harnessesOf(runner.harnesses, harnesses)} />

      <span />

      <span className="truncate text-right text-muted-foreground text-xs tabular-nums">
        Started {since(runner.startedAt)}
      </span>
    </li>
  );
}
