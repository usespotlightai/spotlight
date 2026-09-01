import { took } from '@/lib/inbox';
import type { TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const Field = ({ name, value }: { name: string; value: string }) => (
  <div className="flex gap-3 py-1 text-xs">
    <dt className="w-32 shrink-0 truncate text-muted-foreground">{name}</dt>
    <dd className="min-w-0 flex-1 break-words font-mono text-foreground">
      {value}
    </dd>
  </div>
);

const Block = ({ title, body }: { title: string; body: string }) => (
  <section className="flex flex-col gap-1">
    <h3 className="font-medium text-foreground text-xs">{title}</h3>
    <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-muted-foreground text-xs leading-5">
      {body}
    </pre>
  </section>
);

/**
 * What one row was. Where the protocol and the harness both described the same
 * call, this is where that pays: the model and what it cost come from the
 * harness, and the file, the arguments and the rewrite come from the protocol.
 */
export function SpanDetail({ node }: { node: TraceNode }) {
  const { step, span } = node;

  return (
    <aside className="flex w-96 shrink-0 flex-col gap-4 overflow-y-auto border-border border-l p-4">
      <header className="flex flex-col gap-1">
        <h2
          className={cn(
            'break-words font-medium text-sm',
            node.tone === 'failed' ? 'text-destructive' : 'text-foreground',
          )}
        >
          {node.name}
        </h2>
        <p className="text-muted-foreground text-xs">
          {took(node.to - node.from)}
          {step?.status && ` · ${step.status}`}
          {span && ` · ${span.name}`}
        </p>
      </header>

      {step?.locations.length ? (
        <section className="flex flex-col gap-1">
          <h3 className="font-medium text-foreground text-xs">Where it went</h3>
          <ul className="flex flex-col">
            {step.locations.map((where) => (
              <li
                key={`${where.path}:${where.line}`}
                className="truncate font-mono text-muted-foreground text-xs"
                title={where.path}
              >
                {where.path}
                {where.line !== null && `:${where.line}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {step?.change && (
        <section className="flex flex-col gap-1">
          <h3 className="font-medium text-foreground text-xs">
            {step.change.path ?? 'What changed'}
          </h3>
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-5">
            <span className="text-destructive">
              {step.change.before || '(nothing)'}
            </span>
            {'\n'}
            <span className="text-foreground">
              {step.change.after || '(nothing)'}
            </span>
          </pre>
        </section>
      )}

      {step?.given && <Block title="What it was asked for" body={step.given} />}
      {step?.detail && <Block title="What came back" body={step.detail} />}
      {step?.returned && !step.detail && (
        <Block title="What came back" body={step.returned} />
      )}

      {span && span.attributes.length > 0 && (
        <section className="flex flex-col">
          <h3 className="pb-1 font-medium text-foreground text-xs">
            What the harness reported
          </h3>
          <dl className="divide-y divide-border">
            {span.attributes.map((each) => (
              <Field key={each.name} name={each.name} value={each.value} />
            ))}
          </dl>
        </section>
      )}

      {!step && !span && (
        <p className="text-muted-foreground text-xs">
          Nothing was recorded about this beyond how long it took.
        </p>
      )}
    </aside>
  );
}
