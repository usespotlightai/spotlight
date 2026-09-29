import { CreatePoolForm } from '@/components/features/runners/CreatePoolForm';
import { PoolCreated } from '@/components/features/runners/PoolCreated';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { useCreateRunnerPool } from '@/hooks/api/useCreateRunnerPool';
import type { WorkspaceResponseDto } from '@/lib/api';
import { managesRunners } from '@/lib/role';
import { installCommand } from '@/lib/runner';

const SAYS = 'text-muted-foreground text-xs';

const NONE_YET = 'No host serves this workspace yet.';

type HostInstallProps = {
  workspace: Pick<WorkspaceResponseDto, 'id' | 'role'>;
};

export function HostInstall({ workspace }: HostInstallProps) {
  const creating = useCreateRunnerPool(workspace.id);
  const created = creating.data;

  if (!managesRunners(workspace.role)) {
    return (
      <p className={SAYS}>
        {NONE_YET} An owner or admin of the workspace can add one here.
      </p>
    );
  }

  if (created) {
    return <PoolCreated pool={created.key} token={created.token} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className={SAYS}>
        {NONE_YET} Create a pool for your hosts, then run the install command it
        gives you on a machine with Docker, Podman, OrbStack or Colima.
      </p>

      <CreatePoolForm
        creating={creating.isPending}
        error={creating.error}
        onCreate={(name) => creating.mutate(name)}
        onEdit={() => creating.error && creating.reset()}
      />

      <div className="flex flex-col gap-2">
        <p className={SAYS}>Already have a pool’s token? Install with it:</p>

        <CodeBlock command={installCommand('<pool token>')} />
      </div>
    </div>
  );
}
