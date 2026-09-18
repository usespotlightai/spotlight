import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { CustomiseStationCommand } from '@work/application/commands/customise-station.command';
import type { ProposedChangeDto } from '@work/application/dto/proposed-change.dto';
import type { ProposeLineChange } from '@work/application/services/propose-line-change.service';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

const told = <T>(raw: string | null, make: (value: string) => T): T | null =>
  raw === null ? null : make(raw);

export class CustomiseStationHandler
  implements
    CommandHandlerPort<CustomiseStationCommand, ProposedChangeDto | null>
{
  constructor(private readonly proposals: ProposeLineChange) {}

  async execute(
    command: CustomiseStationCommand,
  ): Promise<ProposedChangeDto | null> {
    try {
      return await this.proposals.propose({
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

  if (!line.holds(stationId)) {
    throw new UnknownStationError(command.stationId);
  }
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
  const changed = Object.entries(command.changes)
    .filter(([, value]) => value !== undefined)
    .map(([each]) => each)
    .map((each) => WORDS[each] ?? each)
    .join(', ');

  return `Changes to the ${station?.name.value ?? 'station'} station on the ${line.name.value} line: ${changed}.`;
};
