import { ShieldQuestion } from 'lucide-react';
import { MeterBar } from '@/components/features/stations/MeterBar';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import {
  formatCalibration,
  formatMeasure,
  formatStat,
  type JudgeCalibration,
  measureNote,
} from '@/lib/judge';

export function AgreementValue({
  calibration,
}: {
  calibration: JudgeCalibration;
}) {
  const measured =
    calibration.agreement !== null && calibration.minAgreement !== null;
  const note = measureNote(calibration.measure);

  return (
    <div
      data-slot="judge-calibration"
      data-qualified={calibration.qualified}
      className="flex max-w-xs flex-col gap-2"
    >
      {measured && (
        <>
          <span className="flex items-center gap-1.5">
            <span className="tabular-nums">
              {formatStat(calibration.agreement)}
            </span>
            <span className="text-muted-foreground">
              {formatMeasure(calibration.measure)}
            </span>
            {note && <InfoTooltip tooltip={note} />}
          </span>
          <MeterBar
            share={calibration.agreement ?? 0}
            label={`${formatMeasure(calibration.measure)} ${formatStat(calibration.agreement)}. Minimum required: ${formatStat(calibration.minAgreement)}`}
            mark={calibration.minAgreement ?? 0}
            markTitle={`Minimum required: ${formatStat(calibration.minAgreement)}`}
          />
        </>
      )}

      {!(calibration.qualified && measured) && (
        <span className="flex items-start gap-1.5 text-muted-foreground">
          <ShieldQuestion aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {formatCalibration(calibration)}
        </span>
      )}
    </div>
  );
}
