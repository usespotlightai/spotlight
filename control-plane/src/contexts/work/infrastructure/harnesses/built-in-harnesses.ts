import { Injectable } from '@nestjs/common';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type {
  HarnessCatalogueEntry,
  HarnessLaunchPort,
  SkillsHome,
} from '@work/application/ports/harness-launch.port';
import type { HarnessCatalog } from '@work/domain/services/harness-catalog';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import { Harness } from '@work/domain/value-objects/harness.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';

type ModelBinding =
  | { readonly kind: 'env'; readonly name: string }
  | { readonly kind: 'arg'; readonly flag: string };

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
  readonly skills: SkillsHome;
}

const BRIEFED_SKILLS: SkillsHome = {
  directory: '.spotlight/skills',
  readByHarness: false,
};

const CLAUDE_CODE: Definition = {
  id: 'claude-code',
  name: 'Claude Code',
  executable: 'claude-agent-acp',
  args: [],
  modelBinding: { kind: 'env', name: 'ANTHROPIC_MODEL' },
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  effortBinding: { kind: 'env', name: 'CLAUDE_CODE_EFFORT_LEVEL' },
  skills: { directory: '.claude/skills', readByHarness: true },
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
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: '1',
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_METRICS_EXPORTER: 'none',
    OTEL_LOGS_EXPORTER: 'none',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: expanded by the runner
    OTEL_EXPORTER_OTLP_ENDPOINT: '${SPOTLIGHT_TELEMETRY_URL}',
    OTEL_TRACES_EXPORT_INTERVAL: '1000',
  },
};

const CURSOR: Definition = {
  id: 'cursor',
  name: 'Cursor CLI',
  executable: 'cursor-agent',
  args: ['acp'],
  env: {},
  modelBinding: { kind: 'arg', flag: '--model' },
  efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  effortBinding: { kind: 'model-bracket' },
  discovery: ['cursor-agent', 'models'],
  skills: BRIEFED_SKILLS,
};

const DEFINITIONS: readonly Definition[] = [CLAUDE_CODE, CURSOR];

export const DEFAULT_HARNESS = HarnessId.of(CLAUDE_CODE.id);

@Injectable()
export class BuiltInHarnesses implements HarnessCatalog, HarnessLaunchPort {
  all(): readonly Harness[] {
    return DEFINITIONS.map(named);
  }

  named(id: HarnessId): Harness | null {
    const found = this.definition(id);

    return found ? named(found) : null;
  }

  skillsFor(id: HarnessId): SkillsHome | null {
    return this.definition(id)?.skills ?? null;
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
