const PILL =
  'shrink-0 rounded-full border border-border bg-card px-2 py-0.5 font-medium text-muted-foreground text-xs';

/** How many are named before the rest are only counted. */
const NAMED = 3;

/**
 * What a runner reported it can run. A machine with everything installed says
 * so in a count rather than a list nobody reads to the end.
 */
export function HarnessPills({ names }: { names: readonly string[] }) {
  if (names.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        Reported nothing it can run
      </span>
    );
  }

  const rest = names.length - NAMED;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {names.slice(0, NAMED).map((name) => (
        <span key={name} className={PILL}>
          {name}
        </span>
      ))}

      {rest > 0 && (
        <span className="shrink-0 text-muted-foreground text-xs">
          +{rest} more
        </span>
      )}
    </span>
  );
}
