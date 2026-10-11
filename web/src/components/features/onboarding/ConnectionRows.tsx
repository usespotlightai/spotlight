import { ConnectionRow } from '@/components/features/onboarding/ConnectionRow';
import type { SetupConnectionResponseDto } from '@/lib/api/types.gen';

type ConnectionRowsProps = {
  connections: readonly SetupConnectionResponseDto[];
};

export function ConnectionRows({ connections }: ConnectionRowsProps) {
  return (
    <section
      aria-labelledby="setup-connections"
      className="flex flex-col gap-3"
    >
      <div>
        <h2
          id="setup-connections"
          className="font-medium text-foreground text-sm leading-6"
        >
          Test your connections
        </h2>
        <p className="text-muted-foreground text-sm leading-6">
          Each source below opens a task. A first task shows it works.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {connections.map((connection) => (
          <ConnectionRow key={connection.source} connection={connection} />
        ))}
      </ul>
    </section>
  );
}
