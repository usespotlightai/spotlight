import { FlaggedCell } from '@/components/features/runners/FlaggedCell';
import { HarnessLogos } from '@/components/features/runners/HarnessLogos';
import {
  type Host,
  holdsNoHarness,
  type NamedHarness,
  servedBy,
} from '@/lib/runner';

const NO_HARNESS =
  'The images of this host hold no harness. The host runs checks, but no agent run. Install Claude Code, Codex, Cursor or OpenCode in an image built from the Spotlight runner image, and name it in SPOTLIGHT_RUNNER_IMAGE.';

type HostHarnessCellProps = {
  host: Host;
  harnesses: readonly NamedHarness[] | undefined;
};

export function HostHarnessCell({ host, harnesses }: HostHarnessCellProps) {
  if (holdsNoHarness(host)) {
    return <FlaggedCell reason={NO_HARNESS}>None</FlaggedCell>;
  }

  return <HarnessLogos harnesses={servedBy(host, harnesses)} />;
}
