import { CLAIMS_LABEL, passShareShown } from '@/lib/judge';

type JudgeClaimsProps = {
  claims: readonly string[];
  passShare: number;
};

export function JudgeClaims({ claims, passShare }: JudgeClaimsProps) {
  return (
    <section data-slot="judge-claims" className="flex flex-col gap-1.5">
      <h3 className="text-muted-foreground text-sm">{CLAIMS_LABEL}</h3>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-foreground text-sm leading-6 marker:text-muted-foreground">
        {claims.map((claim, at) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: a claim is named by its place in the judge's list
            key={at}
            data-slot="judge-claim"
          >
            {claim}
          </li>
        ))}
      </ol>
      <p data-slot="pass-share" className="text-muted-foreground text-xs">
        {passShareShown(passShare)}
      </p>
    </section>
  );
}
