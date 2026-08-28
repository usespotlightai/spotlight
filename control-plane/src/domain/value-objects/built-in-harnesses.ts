import { Harness } from '@domain/entities/harness.entity';
import { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessName } from '@domain/value-objects/harness-name.vo';

const harness = (
  id: string,
  name: string,
  executable: string,
  args: string[],
) =>
  Harness.of({
    id: HarnessId.of(id),
    name: HarnessName.of(name),
    command: HarnessCommand.of({ executable, args }),
  });

// A station's work is unattended, so each harness carries whatever it needs
// to act without stopping to ask.
export const CLAUDE_CODE = harness('claude-code', 'Claude Code', 'claude', [
  '--dangerously-skip-permissions',
]);

// Only list a harness once its unattended invocation has actually been run: a
// flag nobody checked fails at the first task, on the runner, where it is
// hardest to see.
export const BUILT_IN_HARNESSES: readonly Harness[] = [CLAUDE_CODE];

export const harnessNamed = (id: HarnessId): Harness | null =>
  BUILT_IN_HARNESSES.find((each) => each.id.equals(id)) ?? null;
