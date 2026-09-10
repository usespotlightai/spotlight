import type {
  HarnessCatalogueEntry,
  HarnessLaunchPort,
} from '@application/ports/harness-launch.port';
import { Harness } from '@domain/entities/harness.entity';
import type { HarnessRepository } from '@domain/repositories/harness.repository';
import type { Effort } from '@domain/value-objects/effort.vo';
import { HarnessCommand } from '@domain/value-objects/harness-command.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { Injectable } from '@nestjs/common';

/** How a chosen model is told to the harness: an env var, or a CLI flag. */
type ModelBinding =
  | { readonly kind: 'env'; readonly name: string }
  | { readonly kind: 'arg'; readonly flag: string };

/** How a chosen effort is told: an env var, or a bracket on the model value. */
type EffortBinding =
  | { readonly kind: 'env'; readonly name: string }
  | { readonly kind: 'model-bracket' };

interface Definition {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly modelBinding: ModelBinding;
  readonly effortBinding: EffortBinding | null;
  readonly efforts: readonly string[];
  readonly discovery: readonly string[];
}

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
const CLAUDE_CODE: Definition = {
  id: 'claude-code',
  name: 'Claude Code',
  executable: 'claude-agent-acp',
  args: [],
  modelBinding: { kind: 'env', name: 'ANTHROPIC_MODEL' },
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  effortBinding: { kind: 'env', name: 'CLAUDE_CODE_EFFORT_LEVEL' },
  // No list-models command, so discover from the models endpoint. An API key
  // where there is one, else the subscription's OAuth token, which authorizes
  // it the same way; with neither, empty.
  discovery: [
    'sh',
    '-c',
    'if [ -n "$ANTHROPIC_API_KEY" ]; then ' +
      'auth="x-api-key: $ANTHROPIC_API_KEY"; ' +
      'else auth="authorization: Bearer $CLAUDE_CODE_OAUTH_TOKEN"; fi; ' +
      'curl -sf https://api.anthropic.com/v1/models ' +
      '-H "$auth" -H "anthropic-version: 2023-06-01" | jq -r ".data[].id"',
  ],
  env: {
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
};

// The `acp` subcommand turns `cursor-agent` into an ACP server, so the runner
// starts and talks to it exactly as it does Claude Code.
const CURSOR: Definition = {
  id: 'cursor',
  name: 'Cursor CLI',
  executable: 'cursor-agent',
  args: ['acp'],
  env: {},
  modelBinding: { kind: 'arg', flag: '--model' },
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  // Effort rides on the model as a bracket, so it only applies with a model.
  effortBinding: { kind: 'model-bracket' },
  // Needs the same credential the harness runs with; unauthenticated, empty.
  discovery: ['cursor-agent', 'models'],
};

const DEFINITIONS: readonly Definition[] = [CLAUDE_CODE, CURSOR];

/** What a built-in line's work stations start on, until a team chooses otherwise. */
export const DEFAULT_HARNESS = HarnessId.of(CLAUDE_CODE.id);

/** Compiled in rather than stored: nothing here changes without a release. */
@Injectable()
export class BuiltInHarnesses implements HarnessRepository, HarnessLaunchPort {
  all(): readonly Harness[] {
    return DEFINITIONS.map(named);
  }

  named(id: HarnessId): Harness | null {
    const found = this.definition(id);

    return found ? named(found) : null;
  }

  commandFor(
    id: HarnessId,
    chosen: { model: HarnessModel | null; effort: Effort | null },
  ): HarnessCommand | null {
    const def = this.definition(id);

    if (!def) {
      return null;
    }

    const args = [...def.args];
    const env: Record<string, string> = { ...def.env };

    // A model-bracket effort is folded into the model value, and only with one.
    const value =
      def.effortBinding?.kind === 'model-bracket' &&
      chosen.model &&
      chosen.effort
        ? `${chosen.model.value}[effort=${chosen.effort.value}]`
        : (chosen.model?.value ?? null);

    if (value !== null) {
      if (def.modelBinding.kind === 'env') {
        env[def.modelBinding.name] = value;
      } else {
        args.push(def.modelBinding.flag, value);
      }
    }

    if (def.effortBinding?.kind === 'env' && chosen.effort) {
      env[def.effortBinding.name] = chosen.effort.value;
    }

    return HarnessCommand.of({ executable: def.executable, args, env });
  }

  catalogue(): readonly HarnessCatalogueEntry[] {
    return DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      executable: def.executable,
      efforts: def.efforts,
      discovery: def.discovery,
    }));
  }

  private definition(id: HarnessId): Definition | undefined {
    return DEFINITIONS.find((each) => each.id === id.value);
  }
}

const named = (def: Definition): Harness =>
  Harness.of({ id: HarnessId.of(def.id), name: HarnessName.of(def.name) });
