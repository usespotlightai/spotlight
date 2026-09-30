import { CopyBlock } from '@/components/shared/CopyBlock';
import { Button } from '@/components/ui/button';

type TokenCreatedProps = {
  name: string;
  token: string;
  onDone: () => void;
};

export function TokenCreated({ name, token, onDone }: TokenCreatedProps) {
  return (
    <section
      aria-label={`The ${name} token`}
      className="flex flex-col gap-3 rounded-xl border-[0.5px] border-border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-foreground text-sm">
          Copy the {name} token now
        </h2>
        <p className="text-muted-foreground text-xs">
          It is shown only this once. Keep it where secrets go, such as your
          CI’s secret store; if it is lost, revoke it and create another.
        </p>
      </div>

      <CopyBlock text={token} label="Copy token" focused />

      <Button variant="ghost" size="sm" className="self-end" onClick={onDone}>
        I’ve copied it
      </Button>
    </section>
  );
}
