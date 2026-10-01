import { Coins } from 'lucide-react';
import {
  runCost,
  type RunSpend as Spend,
  TOKEN_COUNTS,
  tokensShown,
} from '@/lib/run';

type RunSpendProps = {
  spend: Spend | null;
};

export function RunSpend({ spend }: RunSpendProps) {
  if (!spend) {
    return null;
  }

  return (
    <div
      data-slot="run-spend"
      className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs"
    >
      <Coins aria-hidden className="size-3.5 text-muted-foreground" />
      <span className="font-medium text-foreground">Spent</span>
      <span data-slot="run-cost" className="text-muted-foreground tabular-nums">
        {runCost(spend)}
      </span>
      <dl className="contents">
        {TOKEN_COUNTS.map(({ key, label }) => (
          <div
            key={key}
            data-slot="run-tokens"
            className="flex items-center gap-1 text-muted-foreground"
          >
            <dt className="flex items-center gap-1">
              <span aria-hidden>·</span>
              {label}
            </dt>
            <dd
              className={
                spend[key] === null
                  ? 'text-faint'
                  : 'text-foreground tabular-nums'
              }
            >
              {tokensShown(spend[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
