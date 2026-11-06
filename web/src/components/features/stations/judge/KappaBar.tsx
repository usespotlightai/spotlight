import { MeterBar } from '@/components/features/stations/judge/MeterBar';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  type ClaimAgreement,
  formatStat,
  kappaNote,
  readingWord,
} from '@/lib/judge';

type KappaBarProps = {
  kappa: number | null;
  reading: ClaimAgreement['reading'];
  failing: boolean;
  minAgreement: number | null;
};

export function KappaBar({
  kappa,
  reading,
  failing,
  minAgreement,
}: KappaBarProps) {
  return (
    <WithTooltip
      tooltip={{
        ...kappaNote(),
        title: reading
          ? `Cohen’s kappa: ${readingWord(reading)?.toLowerCase()}`
          : 'Cohen’s kappa',
      }}
    >
      <span className="flex min-w-0 cursor-default items-center gap-2">
        <span className="w-8 shrink-0 text-foreground tabular-nums">
          {formatStat(kappa)}
        </span>
        <MeterBar
          share={kappa}
          marker={minAgreement}
          failing={failing}
          className="min-w-12 flex-1"
        />
      </span>
    </WithTooltip>
  );
}
