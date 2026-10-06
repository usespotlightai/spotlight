const NUMERIC = 'flex items-center justify-end gap-1.5 whitespace-nowrap';

export function ComparisonHeadings({ heldOut }: { heldOut: boolean }) {
  return (
    <div
      aria-hidden
      data-slot="comparison-headings"
      className="col-span-full hidden grid-cols-subgrid items-center border-border border-b pb-1.5 text-[0.7rem] text-muted-foreground @4xl:grid"
    >
      <span>Config</span>
      <span>Source</span>
      <span className="flex justify-between">
        <span>0%</span>
        <span>Replay success</span>
        <span>100%</span>
      </span>
      <span className={NUMERIC}>
        <svg aria-hidden width="10" height="10">
          <circle
            cx="5"
            cy="5"
            r="4"
            fill="none"
            stroke="var(--chart-axis)"
            strokeWidth="1.5"
          />
        </svg>
        Candidate
      </span>
      <span className={NUMERIC}>
        <svg aria-hidden width="4" height="12">
          <line
            x1="2"
            x2="2"
            y1="1"
            y2="11"
            stroke="var(--chart-axis)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Live
      </span>
      <span>Against live</span>
      <span className={NUMERIC}>Cost per run</span>
      <span className={NUMERIC}>Live cost</span>
      {heldOut && <span className={NUMERIC}>Held out</span>}
      <span className={NUMERIC}>Runs</span>
      <span />
    </div>
  );
}
