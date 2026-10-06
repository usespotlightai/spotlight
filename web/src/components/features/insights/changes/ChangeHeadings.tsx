export function ChangeHeadings() {
  return (
    <div
      aria-hidden
      data-slot="change-headings"
      className="col-span-full hidden grid-cols-subgrid items-center border-border border-b pb-1.5 text-[0.7rem] text-muted-foreground @3xl:grid"
    >
      <span>First run</span>
      <span>Line</span>
      <span>Station</span>
      <span>What changed</span>
      <span className="text-right">Runs before</span>
      <span className="text-right">Runs after</span>
      <span />
    </div>
  );
}
