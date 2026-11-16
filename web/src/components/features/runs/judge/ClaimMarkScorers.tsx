const COLUMN = 'flex w-6 justify-center whitespace-nowrap';

export function ClaimMarkScorers({ scorers }: { scorers: readonly string[] }) {
  return (
    <div
      aria-hidden
      data-slot="claim-verdict-scorers"
      className="flex justify-end gap-4 pr-1 text-muted-foreground text-xs leading-5"
    >
      {scorers.map((scorer) => (
        <span key={scorer} className={COLUMN}>
          {scorer}
        </span>
      ))}
    </div>
  );
}
