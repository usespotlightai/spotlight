import { InfoTooltip } from '@/components/shared/InfoTooltip';
import {
  formatCalibration,
  formatStat,
  type JudgeCalibration,
  measureNote,
  readingWord,
} from '@/lib/judge';

export function AgreementValue({
  calibration,
}: {
  calibration: JudgeCalibration;
}) {
  const { agreement, minAgreement, measure, qualified, hiddenReason } =
    calibration;
  const note = measureNote(measure);

  if (agreement === null || minAgreement === null) {
    return (
      <span
        data-slot="judge-calibration"
        data-qualified={qualified}
        className="text-muted-foreground"
      >
        {formatCalibration(calibration)}
      </span>
    );
  }

  const band = readingWord(calibration.reading);
  const below = hiddenReason === 'below-min-agreement';

  return (
    <div
      data-slot="judge-calibration"
      data-qualified={qualified}
      className="flex flex-col"
    >
      <span className="flex items-center gap-1.5">
        <span className="tabular-nums">{formatStat(agreement)}</span>
        {band && <span className="text-muted-foreground">{band}</span>}
        {note && <InfoTooltip tooltip={note} />}
      </span>
      {below && (
        <span className="text-outcome-failed">
          Below the minimum. Judge scores are hidden.
        </span>
      )}
      {!qualified && !below && (
        <span className="text-muted-foreground">
          {formatCalibration(calibration)}
        </span>
      )}
    </div>
  );
}
