import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { SettingRows } from '@/components/features/stations/config/SettingRows';
import { JudgeClaims } from '@/components/features/stations/judge/JudgeClaims';
import { StationSection } from '@/components/features/stations/StationSection';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { JUDGE_ANCHOR } from '@/lib/station';
import { type JudgeSettings, sharePercent } from '@/lib/station-watch';
import { cn } from '@/lib/utils';

type StationJudgeSettingsProps = {
  stationId: string;
  judge: JudgeSettings | null;
};

export function StationJudgeSettings({
  stationId,
  judge,
}: StationJudgeSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <StationSection title="Judge" id={JUDGE_ANCHOR}>
      {judge ? (
        <>
          <SettingRows
            rows={[
              {
                label: 'Judges',
                value: `${sharePercent(judge.sample)} of runs`,
              },
              {
                label: 'Minimum agreement to trust',
                value: judge.trust.toFixed(2),
              },
            ]}
          />

          {judge.claims.length > 0 && (
            <JudgeClaims claims={judge.claims} passShare={judge.passShare} />
          )}

          {judge.rubric !== null && (
            <>
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
            </>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          No judge. Only people score runs here.
        </p>
      )}
    </StationSection>
  );
}
