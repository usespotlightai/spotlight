import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { StationSection } from '@/components/features/stations/StationSection';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { type JudgeSettings, sharePercent } from '@/lib/station-watch';
import { cn } from '@/lib/utils';

type StationJudgeProps = {
  stationId: string;
  judge: JudgeSettings;
};

export function StationJudge({ stationId, judge }: StationJudgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <StationSection title="Judge">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Judges</dt>
        <dd className="text-foreground">
          {sharePercent(judge.sample)} of runs
        </dd>
        <dt className="text-muted-foreground">Trusted after</dt>
        <dd className="text-foreground">
          agreeing with people {sharePercent(judge.trust)} of the time
        </dd>
      </dl>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-fit items-center gap-1 rounded py-0.5 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        Rubric
      </button>

      {open && (
        <MarkdownEditor
          key={stationId}
          initialValue={judge.rubric}
          readOnly
          ariaLabel="Rubric"
          placeholder=""
          className="bg-card"
        />
      )}
    </StationSection>
  );
}
