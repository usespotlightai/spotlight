import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { MeterLabel } from '@/components/features/stations/config/MeterLabel';
import { MeterBar } from '@/components/features/stations/MeterBar';
import {
  formatCalibration,
  formatMeasure,
  formatStat,
  type JudgeCalibration,
  measureNote,
} from '@/lib/judge';

export function AgreementMeter({
  calibration,
}: {
  calibration: JudgeCalibration;
}) {
  const Icon = calibration.qualified ? ShieldCheck : ShieldQuestion;
  const measured =
    calibration.agreement !== null && calibration.minAgreement !== null;

  return (
    <div
      data-slot="judge-calibration"
      data-qualified={calibration.qualified}
      className="flex flex-col gap-1.5"
    >
      {measured && (
        <>
          <MeterLabel
            label={formatMeasure(calibration.measure)}
            value={formatStat(calibration.agreement)}
            tooltip={measureNote(calibration.measure)}
          />
          <MeterBar
            share={calibration.agreement ?? 0}
            label={`${formatMeasure(calibration.measure)} ${formatStat(calibration.agreement)}. Minimum required: ${formatStat(calibration.minAgreement)}`}
            mark={calibration.minAgreement ?? 0}
            markTitle={`Minimum required: ${formatStat(calibration.minAgreement)}`}
          />
        </>
      )}

      <p className="flex items-start gap-1.5 text-[0.7rem] text-muted-foreground leading-4">
        <Icon aria-hidden className="mt-px size-3 shrink-0" />
        {calibration.qualified && measured
          ? `Qualified above ${formatStat(calibration.minAgreement)} over ${calibration.pairs} runs`
          : formatCalibration(calibration)}
      </p>
    </div>
  );
}
