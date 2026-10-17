import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { MeterLabel } from '@/components/features/stations/config/MeterLabel';
import { MeterBar } from '@/components/features/stations/MeterBar';
import {
  formatMeasure,
  formatStanding,
  formatStat,
  type JudgeStanding,
} from '@/lib/judge';

export function AgreementMeter({ standing }: { standing: JudgeStanding }) {
  const Icon = standing.trusted ? ShieldCheck : ShieldQuestion;
  const measured = standing.agreement !== null && standing.trust !== null;

  return (
    <div
      data-slot="judge-standing"
      data-trusted={standing.trusted}
      className="flex flex-col gap-1.5"
    >
      {measured && (
        <>
          <MeterLabel
            label={formatMeasure(standing.measure)}
            value={formatStat(standing.agreement)}
          />
          <MeterBar
            share={standing.agreement ?? 0}
            label={`${formatMeasure(standing.measure)} ${formatStat(standing.agreement)}. Minimum required: ${formatStat(standing.trust)}`}
            mark={standing.trust ?? 0}
            markTitle={`Minimum required: ${formatStat(standing.trust)}`}
          />
        </>
      )}

      <p className="flex items-start gap-1.5 text-[0.7rem] text-muted-foreground leading-4">
        <Icon aria-hidden className="mt-px size-3 shrink-0" />
        {standing.trusted && measured
          ? `Trusted above ${formatStat(standing.trust)} over ${standing.pairs} runs`
          : formatStanding(standing)}
      </p>
    </div>
  );
}
