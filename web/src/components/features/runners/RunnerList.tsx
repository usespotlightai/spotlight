import { HostHead } from '@/components/features/runners/HostHead';
import { HostRow } from '@/components/features/runners/HostRow';
import { ProvisionedHead } from '@/components/features/runners/ProvisionedHead';
import { ProvisionedRunnerRow } from '@/components/features/runners/ProvisionedRunnerRow';
import {
  type Host,
  harnessesOf,
  type NamedHarness,
  type ProvisionedRunner,
} from '@/lib/runner';

type RunnerListProps = {
  hosts: readonly Host[];
  provisioned: readonly ProvisionedRunner[];
  harnesses: readonly NamedHarness[] | undefined;
};

export function RunnerList({ hosts, provisioned, harnesses }: RunnerListProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5 pb-1.5">
      {hosts.length > 0 && (
        <section aria-label="Hosts">
          <HostHead />

          <ul className="flex flex-col">
            {hosts.map((host) => (
              <HostRow key={host.id} host={host} harnesses={harnesses} />
            ))}
          </ul>
        </section>
      )}

      {provisioned.length > 0 && (
        <section aria-label="Provisioned by a pool">
          <ProvisionedHead />

          <ul className="flex flex-col">
            {provisioned.map((runner) => (
              <ProvisionedRunnerRow
                key={runner.id}
                runner={runner}
                harnesses={harnessesOf(runner.harnesses, harnesses)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
