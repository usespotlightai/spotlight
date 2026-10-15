import { CLAIMS_LABEL, passShareShown } from '@/lib/judge';

type JudgeClaimsProps = {
  claims: readonly string[];
  passShare: number;
};

export function JudgeClaims({ claims, passShare }: JudgeClaimsProps) {
  return (
    <section
      data-slot="judge-claims"
      className="flex flex-col gap-1.5 border-border border-t pt-2 text-xs leading-5"
    >
      <h3 className="text-muted-foreground">{CLAIMS_LABEL}</h3>
      <ol className="flex list-decimal flex-col gap-0.5 pl-4 text-foreground marker:text-muted-foreground">
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
      <p data-slot="pass-share" className="text-muted-foreground">
        {passShareShown(passShare)}
      </p>
    </section>
  );
}
