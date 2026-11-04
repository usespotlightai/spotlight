export function JudgeClaims({ claims }: { claims: readonly string[] }) {
  return (
    <ol
      data-slot="judge-claims"
      className="flex list-decimal flex-col gap-1 pl-5 text-foreground text-sm leading-6 marker:text-muted-foreground"
    >
      {claims.map((claim, at) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: the position of a claim in the judge's list identifies it
          key={at}
          data-slot="judge-claim"
        >
          {claim}
        </li>
      ))}
    </ol>
  );
}
