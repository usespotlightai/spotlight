import type { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { ProposeConfigurationChange } from '@application/services/propose-configuration-change.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { Effort } from '@domain/value-objects/effort.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';

const told = <T>(raw: string | null, make: (value: string) => T): T | null =>
  raw === null ? null : make(raw);

export class CustomiseStationHandler
  implements
    CommandHandlerPort<CustomiseStationCommand, OpenedPullRequestDto | null>
{
  constructor(private readonly proposals: ProposeConfigurationChange) {}

  async execute(
    command: CustomiseStationCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      return await this.proposals.proposeLine({
        teamId: command.teamId,
        viewerId: command.viewerId,
        lineId: command.lineId,
        change: (base) => applied(base, command),
        describe: (edited) => summaryOf(edited, command),
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

const applied = (line: Line, command: CustomiseStationCommand): Line => {
  const stationId = StationId.of(command.stationId);
  const {
    name,
    color,
    description,
    harness,
    model,
    effort,
    agentPrompt,
    skills,
  } = command.changes;
  let edited = line;

  if (name !== undefined) {
    edited = edited.renameStation(stationId, StationName.of(name));
  }
  if (color !== undefined) {
    edited = edited.repaintStation(stationId, StationColor.of(color));
  }
  if (description !== undefined) {
    edited = edited.describeStation(
      stationId,
      told(description, StationDescription.of),
    );
  }
  if (harness !== undefined || model !== undefined) {
    edited = edited.changeStationHarness(stationId, {
      ...(harness !== undefined
        ? { harness: told(harness, HarnessId.of) }
        : {}),
      ...(model !== undefined ? { model: told(model, HarnessModel.of) } : {}),
    });
  }
  if (effort !== undefined) {
    edited = edited.setStationEffort(stationId, told(effort, Effort.of));
  }
  if (agentPrompt !== undefined) {
    edited = edited.instructStation(
      stationId,
      told(agentPrompt, AgentPrompt.of),
    );
  }

  if (skills !== undefined) {
    edited = edited.giveStationSkills(
      stationId,
      skills.map((each) => SkillKey.of(each)),
    );
  }

  return edited;
};

const WORDS: Record<string, string> = {
  name: 'name',
  color: 'colour',
  description: 'description',
  harness: 'harness',
  model: 'model',
  effort: 'effort',
  agentPrompt: 'agent prompt',
  skills: 'skills',
};

const summaryOf = (line: Line, command: CustomiseStationCommand): string => {
  const station = line.stationAt(StationId.of(command.stationId));
  const changed = Object.keys(command.changes)
    .map((each) => WORDS[each] ?? each)
    .join(', ');

  return `Changes to the ${station?.name.value ?? 'station'} station on the ${line.name.value} line: ${changed}.`;
};
