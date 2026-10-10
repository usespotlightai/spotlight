import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { MeterLabel } from '@/components/features/stations/config/MeterLabel';
import { MeterBar } from '@/components/features/stations/MeterBar';
import {
  type JudgeStanding,
  measureShown,
  standingShown,
  statShown,
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
            label={measureShown(standing.measure)}
            value={statShown(standing.agreement)}
          />
          <MeterBar
            share={standing.agreement ?? 0}
            label={`${measureShown(standing.measure)} ${statShown(standing.agreement)} against a minimum of ${statShown(standing.trust)}`}
            mark={standing.trust ?? 0}
            markTitle={`Minimum required: ${statShown(standing.trust)}`}
          />
        </>
      )}

      <p className="flex items-start gap-1.5 text-[0.7rem] text-muted-foreground leading-4">
        <Icon aria-hidden className="mt-px size-3 shrink-0" />
        {standing.trusted && measured
          ? `Trusted above ${statShown(standing.trust)} over ${standing.pairs} runs`
          : standingShown(standing)}
      </p>
    </div>
  );
}
