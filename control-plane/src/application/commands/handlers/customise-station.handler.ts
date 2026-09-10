import type { CustomiseStationCommand } from '@application/commands/customise-station.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { OpenedPullRequestDto } from '@application/ports/pull-request.port';
import type { ProposeLineChange } from '@application/services/propose-line-change.service';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { Effort } from '@domain/value-objects/effort.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';

const told = <T>(raw: string | null, make: (value: string) => T): T | null =>
  raw === null ? null : make(raw);

/** A station edit, proposed to the configuration repository as a pull request. */
export class CustomiseStationHandler
  implements
    CommandHandlerPort<CustomiseStationCommand, OpenedPullRequestDto | null>
{
  constructor(private readonly proposals: ProposeLineChange) {}

  async execute(
    command: CustomiseStationCommand,
  ): Promise<OpenedPullRequestDto | null> {
    try {
      return await this.proposals.propose({
        teamId: command.teamId,
        viewerId: command.viewerId,
        lineId: command.lineId,
        change: (base) => applied(base, command),
        describe: (edited) => ({
          title: 'Update Spotlight configuration',
          body: bodyFor(edited, command),
        }),
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

const applied = (
  line: AssemblyLine,
  command: CustomiseStationCommand,
): AssemblyLine => {
  const stationId = StationId.of(command.stationId);
  const { name, color, description, harness, model, effort, agentPrompt } =
    command.changes;
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
  // The harness and its model are one choice: whichever the edit names, the
  // other is taken from where the station already stands, and set together.
  if (harness !== undefined || model !== undefined) {
    const standing = line.stationAt(stationId);
    const nextHarness =
      harness !== undefined ? told(harness, HarnessId.of) : standing?.harness;
    const nextModel =
      model !== undefined ? told(model, HarnessModel.of) : standing?.model;

    edited = edited.runStationOn(
      stationId,
      nextHarness ?? null,
      nextModel ?? null,
    );
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
};

const bodyFor = (
  line: AssemblyLine,
  command: CustomiseStationCommand,
): string => {
  const station = line.stationAt(StationId.of(command.stationId));
  const changed = Object.keys(command.changes)
    .map((each) => WORDS[each] ?? each)
    .join(', ');

  return [
    `Changes to the ${station?.name.value ?? 'station'} station on the ${line.name.value} line: ${changed}.`,
    'The board changes when this is merged and read back — nothing here takes effect on its own.',
  ].join('\n\n');
};
