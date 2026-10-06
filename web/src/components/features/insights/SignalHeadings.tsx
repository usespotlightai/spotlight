const HEADING = 'flex items-center justify-end gap-1.5 whitespace-nowrap';

export function SignalHeadings() {
  return (
    <div
      aria-hidden
      data-slot="signal-headings"
      className="col-span-full hidden grid-cols-subgrid items-center border-border border-b pb-1.5 text-[0.7rem] text-muted-foreground md:grid"
    >
      <span>Station</span>
      <span>Signal</span>
      <span />
      <span className={HEADING}>
        <svg aria-hidden width="10" height="10">
          <circle cx="5" cy="5" r="4.5" fill="var(--destructive)" />
        </svg>
        This period
      </span>
      <span className={HEADING}>
        <svg aria-hidden width="10" height="10">
          <circle
            cx="5"
            cy="5"
            r="3.5"
            fill="var(--card)"
            stroke="var(--chart-axis)"
            strokeWidth="1.5"
          />
        </svg>
        Period before
      </span>
      <span className={HEADING}>
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
        All stations
      </span>
      <span className={HEADING}>
        <svg aria-hidden width="4" height="12">
          <line
            x1="2"
            x2="2"
            y1="0"
            y2="12"
            stroke="var(--destructive)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        </svg>
        Flagged above
      </span>
      <span />
    </div>
  );
}
