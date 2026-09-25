import { CodeBlock } from '@/components/shared/CodeBlock';

const installLine = () =>
  `curl -fsSL ${window.location.origin}/api/install.sh | SPOTLIGHT_TOKEN=<pool token> sh`;

export function HostInstall() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">
        No host is serving this workspace. On any machine with Docker, Podman,
        OrbStack or Colima, install one with a pull pool’s token:
      </p>

      <CodeBlock command={installLine()} />
    </div>
  );
}
