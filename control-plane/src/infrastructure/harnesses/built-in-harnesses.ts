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

It also reports on itself in OpenTelemetry, which says what the protocol cannot:
which model answered a turn, what one call to it cost, and how long the agent
waited on a person. That goes to the collector the runner raises on loopback for
the run, and travels back in the run's own journal.

Only traces are wanted, and only structure: metrics and logs are turned off by
name rather than left to default, and nothing that would carry prompts, tool
arguments or whole conversations is turned on. The console exporter must never
be named here — it writes to stdout, which is the protocol's own channel, and
would leave the runner reading telemetry where it expects an agent.
*/
export const CLAUDE_CODE = harness(
  'claude-code',
  'Claude Code',
  'claude-agent-acp',
  [],
  {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
    CLAUDE_CONFIG_DIR: '${SPOTLIGHT_STATE_DIR}/claude',
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    // Traces are behind a flag of their own while they are in beta.
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: '1',
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_METRICS_EXPORTER: 'none',
    OTEL_LOGS_EXPORTER: 'none',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
    OTEL_EXPORTER_OTLP_ENDPOINT: '${SPOTLIGHT_TELEMETRY_URL}',
    // Exports are batched, and a run that ends is not waited for: anything
    // still held when the harness goes is lost.
    OTEL_TRACES_EXPORT_INTERVAL: '1000',
  },
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
