import { InvalidLinePlanError } from '@domain/exceptions/invalid-line-plan.error';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Effort } from '@domain/value-objects/effort.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { LinePlan } from '@domain/value-objects/line-plan.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { lineSchema } from '@infrastructure/integrations/line.schema';
import { parse as parseYaml } from 'yaml';

export type CompiledLine =
  | { readonly ok: true; readonly line: LinePlan }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

const reasoned = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const PLAIN = '#a3a8b0';

export const compileLine = (path: string, text: string): CompiledLine => {
  let held: unknown;

  try {
    held = parseYaml(text);
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: 'the file',
          reason: `is not YAML: ${reasoned(error)}`,
        }),
      ],
    };
  }

  const read = lineSchema.safeParse(held);

  if (!read.success) {
    return {
      ok: false,
      problems: read.error.issues.map((issue) =>
        ConfigurationProblem.of({
          path,
          at: issue.path.length > 0 ? issue.path.join('.') : 'the file',
          reason: issue.message,
        }),
      ),
    };
  }

  const file = read.data;
  const repositories: Repository[] = [];
  const problems: ConfigurationProblem[] = [];

  for (const [at, named] of file.repositories.entries()) {
    try {
      repositories.push(Repository.of(named));
    } catch (error) {
      problems.push(
        ConfigurationProblem.of({
          path,
          at: `repositories.${at}`,
          reason: reasoned(error),
        }),
      );
    }
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }

  try {
    return {
      ok: true,
      line: LinePlan.of({
        key: LineKey.of(file.key),
        name: LineName.of(file.name),
        stations: file.stations.map((station) => ({
          key: StationKey.of(station.key),
          name: StationName.of(station.name),
          kind: station.kind,
          color: StationColor.of(station.color ?? PLAIN),
          description: station.description
            ? StationDescription.of(station.description)
            : null,
          harness: station.harness ? HarnessId.of(station.harness) : null,
          model: station.model ? HarnessModel.of(station.model) : null,
          effort: station.effort ? Effort.of(station.effort) : null,
          agentPrompt: station.prompt ? AgentPrompt.of(station.prompt) : null,
          tools: station.tools.map((each) => Tool.of(each)),
          skills: station.skills.map((each) => SkillKey.of(each)),
          passesTo: station.passesTo.map((each) => StationKey.of(each)),
          ends: station.ends,
        })),
        reactions: file.reactions.map((reaction) => ({
          happening: Happening.of(reaction.happening),
          from: reaction.from ? StationKey.of(reaction.from) : null,
          to: StationKey.of(reaction.to),
        })),
        role: file.role ? LineRole.of(file.role) : null,
        repositories,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      problems: [
        ConfigurationProblem.of({
          path,
          at: error instanceof InvalidLinePlanError ? error.at : 'the file',
          reason: reasoned(error),
        }),
      ],
    };
  }
};
