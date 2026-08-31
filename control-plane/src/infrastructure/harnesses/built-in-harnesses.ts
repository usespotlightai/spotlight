import { Harness } from '@domain/entities/harness.entity';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { Injectable } from '@nestjs/common';

const harness = (
  id: string,
  name: string,
  executable: string,
  args: string[],
  env: Record<string, string> = {},
) =>
  Harness.of({
    id: HarnessId.of(id),
    name: HarnessName.of(name),
    command: HarnessCommand.of({ executable, args, env }),
  });

/*
Spoken to over the Agent Client Protocol, so permission is answered through the
protocol rather than waived on a command line.

Its config directory goes in the run's state directory, so the session history
lands with the workspace rather than on whichever machine ran it. It signs in
with CLAUDE_CODE_OAUTH_TOKEN instead of the credentials file it would keep
there, so what stays behind carries no secret.
*/
export const CLAUDE_CODE = harness(
  'claude-code',
  'Claude Code',
  'claude-agent-acp',
  [],
  // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
  { CLAUDE_CONFIG_DIR: '${SPOTLIGHT_STATE_DIR}/claude' },
);

// Only list a harness once its unattended invocation has actually been run: a
// flag nobody checked fails at the first task, on the runner, where it is
// hardest to see.
const BUILT_IN: readonly Harness[] = [CLAUDE_CODE];

/** Compiled in rather than stored: nothing here changes without a release. */
@Injectable()
export class BuiltInHarnesses implements HarnessRepository {
  all(): readonly Harness[] {
    return BUILT_IN;
  }

  named(id: HarnessId): Harness | null {
    return BUILT_IN.find((each) => each.id.equals(id)) ?? null;
  }
}
