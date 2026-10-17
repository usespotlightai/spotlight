import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { MeterLabel } from '@/components/features/stations/config/MeterLabel';
import { MeterBar } from '@/components/features/stations/MeterBar';
import {
  formatCalibration,
  formatMeasure,
  formatStat,
  type JudgeCalibration,
} from '@/lib/judge';

export function AgreementMeter({
  calibration,
}: {
  calibration: JudgeCalibration;
}) {
  const Icon = calibration.trusted ? ShieldCheck : ShieldQuestion;
  const measured = calibration.agreement !== null && calibration.trust !== null;

  return (
    <div
      data-slot="judge-calibration"
      data-trusted={calibration.trusted}
      className="flex flex-col gap-1.5"
    >
      {measured && (
        <>
          <MeterLabel
            label={formatMeasure(calibration.measure)}
            value={formatStat(calibration.agreement)}
          />
          <MeterBar
            share={calibration.agreement ?? 0}
            label={`${formatMeasure(calibration.measure)} ${formatStat(calibration.agreement)}. Minimum required: ${formatStat(calibration.trust)}`}
            mark={calibration.trust ?? 0}
            markTitle={`Minimum required: ${formatStat(calibration.trust)}`}
          />
        </>
      )}

      <p className="flex items-start gap-1.5 text-[0.7rem] text-muted-foreground leading-4">
        <Icon aria-hidden className="mt-px size-3 shrink-0" />
        {calibration.trusted && measured
          ? `Trusted above ${formatStat(calibration.trust)} over ${calibration.pairs} runs`
          : formatCalibration(calibration)}
      </p>
    </div>
  );
}
