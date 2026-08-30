import { SaidCard } from '@/components/inbox/SaidCard';

type PersonSaidProps = {
  body: string;
  name?: string | null;
};

export function PersonSaid({ body, name }: PersonSaidProps) {
  return (
    <SaidCard>
      {name && (
        <span className="font-medium text-muted-foreground text-xs">
          {name}
        </span>
      )}

      <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
        {body}
      </p>
    </SaidCard>
  );
}
