import { ShieldCheck, ShieldQuestion } from 'lucide-react';
import { type JudgeStanding, standingShown } from '@/lib/judge';

export function JudgeStandingNote({ standing }: { standing: JudgeStanding }) {
  const Icon = standing.trusted ? ShieldCheck : ShieldQuestion;

  return (
    <p
      data-slot="judge-standing"
      data-trusted={standing.trusted}
      className="flex items-start gap-1.5 text-sm leading-6"
    >
      <Icon
        aria-hidden
        className="mt-1 size-4 shrink-0 text-muted-foreground"
      />
      <span
        className={
          standing.trusted ? 'text-foreground' : 'text-muted-foreground'
        }
      >
        {standingShown(standing)}
      </span>
    </p>
  );
}
