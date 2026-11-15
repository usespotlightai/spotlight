import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import {
  belowMinimumNote,
  formatCalibration,
  formatStat,
  type JudgeCalibration,
  measureNote,
  NOT_MEASURED,
  readingWord,
  tooFewRunsNote,
} from '@/lib/judge';

const VALUE = 'flex flex-wrap items-center gap-x-1.5';

export function AgreementValue({
  calibration,
}: {
  calibration: JudgeCalibration;
}) {
  const { agreement, qualified, hiddenReason } = calibration;
  const band = readingWord(calibration.reading);
  const below = hiddenReason === 'below-min-agreement';

  if (agreement === null || (hiddenReason !== null && !below)) {
    return (
      <span
        data-slot="judge-calibration"
        data-qualified={qualified}
        className={VALUE}
      >
        <span>{NOT_MEASURED}</span>
        <InfoTooltip
          tooltip={
            hiddenReason === 'too-few-pairs'
              ? tooFewRunsNote(calibration)
              : formatCalibration(calibration)
          }
        />
      </span>
    );
  }

  return (
    <span
      data-slot="judge-calibration"
      data-qualified={qualified}
      className={VALUE}
    >
      <span
        className={below ? 'text-destructive tabular-nums' : 'tabular-nums'}
      >
        {formatStat(agreement)}
      </span>
      {band && <span className="text-muted-foreground">{band}</span>}
      {below ? (
        <WarningTooltip
          data-slot="below-minimum"
          label="Below the minimum"
          tooltip={belowMinimumNote(calibration)}
          tone="destructive"
        />
      ) : (
        <InfoTooltip tooltip={measureNote()} />
      )}
    </span>
  );
}
