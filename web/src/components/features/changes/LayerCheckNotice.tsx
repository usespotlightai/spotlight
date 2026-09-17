import { LayerCheckMark } from '@/components/features/changes/LayerCheckMark';
import { type LayerCheck, tookFor } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

type LayerCheckNoticeProps = {
  check: LayerCheck;
};

const Command = ({ command }: { command: string }) => (
  <code className="rounded border-[0.5px] border-border bg-muted/60 px-1 font-mono text-[11px] text-muted-foreground">
    {command}
  </code>
);

export function LayerCheckNotice({ check }: LayerCheckNoticeProps) {
  if (check.state === 'none') {
    return null;
  }

  if (check.state === 'skipped') {
    return check.reason ? (
      <p className="text-faint text-xs">
        Not checked on its own: {check.reason}
      </p>
    ) : null;
  }

  const title = {
    waiting: 'Checking whether this layer builds on its own',
    passed: 'Builds on its own',
    failed: 'Does not build on its own',
  }[check.state];

  return (
    <section
      aria-label="Build check"
      className={cn(
        'flex flex-col gap-2 rounded-lg border-[0.5px] border-border bg-card px-4 py-3',
        check.state === 'failed' && 'border-destructive/40',
      )}
    >
      <div className="flex items-center gap-2">
        <LayerCheckMark check={check} />
        <p className="font-medium text-foreground text-sm">{title}</p>
        {check.state !== 'waiting' && (
          <span className="ml-auto text-faint text-xs tabular-nums">
            {tookFor(check.tookMs)}
          </span>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        <Command command={check.command} />{' '}
        {check.state === 'waiting'
          ? 'runs with this layer and the ones before it, once the run ends.'
          : check.state === 'passed'
            ? 'passed with this layer and the ones before it.'
            : 'failed with this layer and the ones before it.'}
      </p>

      {check.state === 'failed' && check.output && (
        <details className="group">
          <summary className="cursor-pointer select-none text-muted-foreground text-xs hover:text-foreground">
            What it printed
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-muted/60 p-3 font-mono text-[11px] text-muted-foreground leading-relaxed">
            {check.output}
          </pre>
        </details>
      )}
    </section>
  );
}
