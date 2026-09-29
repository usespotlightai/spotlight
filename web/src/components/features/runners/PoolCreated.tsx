import { InstallCommand } from '@/components/features/runners/InstallCommand';
import { installCommand } from '@/lib/runner';

type PoolCreatedProps = {
  pool: string;
  token: string;
};

export function PoolCreated({ pool, token }: PoolCreatedProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        Run this on a machine with Docker, Podman, OrbStack or Colima. It
        installs Spotlight and connects the machine to the {pool} pool. The
        token in it is shown only this once.
      </p>

      <InstallCommand command={installCommand(token)} focused />
    </div>
  );
}
