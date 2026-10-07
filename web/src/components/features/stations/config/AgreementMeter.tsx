import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { MeterLabel } from '@/components/features/stations/config/MeterLabel';
import {
  type JudgeStanding,
  measureShown,
  standingShown,
  statShown,
} from '@/lib/judge';

const placed = (value: number): string =>
  `${Math.min(Math.max(value, 0), 1) * 100}%`;

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
          <div
            role="img"
            aria-label={`${measureShown(standing.measure)} ${statShown(standing.agreement)} against a minimum of ${statShown(standing.trust)}`}
            className="relative h-1.5 rounded-full bg-muted"
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-chart-primary"
              style={{ width: placed(standing.agreement ?? 0) }}
            />
            <span
              aria-hidden
              title={`Minimum required: ${statShown(standing.trust)}`}
              className="absolute -inset-y-1 w-px bg-foreground/40"
              style={{ left: placed(standing.trust ?? 0) }}
            />
          </div>
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
