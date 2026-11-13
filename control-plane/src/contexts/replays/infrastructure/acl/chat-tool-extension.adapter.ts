import { TEST_STATION_CHANGE_TOOL } from '@replays/application/rendering/improve-station';
import type {
  ImprovingChat,
  TestStationChange,
} from '@replays/application/services/test-station-change.service';
import type { JsonValue } from '@shared-kernel/domain/json-value';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ChatToolDeclaration,
  ChatToolExtension,
  ChatToolExtensionContext,
  ChatToolOffer,
} from '@work/application/ports/chat-tool-extensions.port';

const DECLARATION: ChatToolDeclaration = {
  tool: TEST_STATION_CHANGE_TOOL,
  description:
    'Measure a change to the station this chat improves. Spotlight replays it against the live config and tells the person the result in the inbox.',
  inputs: [
    {
      name: 'name',
      schema: { type: 'string' },
      description:
        'A slug that names the change, for example shorter-prompt. It must differ from the names of other candidates',
      required: true,
      stdin: false,
    },
    {
      name: 'hypothesis',
      schema: { type: 'string' },
      description: 'What you expect the change to improve',
      required: true,
      stdin: false,
    },
    {
      name: 'config',
      schema: { type: 'string' },
      description:
        "The station fields you change, as JSON with the names the line resource uses. Spotlight takes every other field from the station's current config, or from the running search's starting config. null removes a field",
      required: true,
      stdin: true,
    },
    {
      name: 'mode',
      schema: { type: 'string', enum: ['test', 'search'] },
      description:
        'test replays only this change. search also lets the search agent refine it. Default: test',
      required: false,
      stdin: false,
    },
    {
      name: 'line',
      schema: { type: 'string' },
      description: 'The line of the station, by its key',
      required: false,
      stdin: false,
    },
    {
      name: 'station',
      schema: { type: 'string' },
      description: 'The station, by its key',
      required: false,
      stdin: false,
    },
  ],
};

const chatOf = (context: ChatToolExtensionContext): ImprovingChat => ({
  workspaceId: WorkspaceId.of(context.workspaceId),
  startedBy: UserId.of(context.startedBy),
  target: context.target && {
    teamId: TeamId.of(context.target.teamId),
    lineId: LineId.of(context.target.lineId),
    lineKey: context.target.lineKey,
    lineName: context.target.lineName,
    stationId: StationId.of(context.target.stationId),
    stationKey: context.target.stationKey,
    stationName: context.target.stationName,
  },
});

const textOf = (value: JsonValue | undefined): string | null =>
  typeof value === 'string' ? value : null;

const namedOf = (value: JsonValue | undefined): string | null =>
  textOf(value)?.trim() || null;

export class TestStationChangeExtension implements ChatToolExtension {
  readonly declaration = DECLARATION;

  constructor(private readonly tests: TestStationChange) {}

  offerFor(context: ChatToolExtensionContext): Promise<ChatToolOffer> {
    return this.tests.offerFor(chatOf(context));
  }

  call(
    context: ChatToolExtensionContext,
    inputs: Readonly<Record<string, JsonValue>>,
  ): Promise<JsonValue> {
    return this.tests.call(chatOf(context), {
      line: namedOf(inputs.line),
      station: namedOf(inputs.station),
      mode: namedOf(inputs.mode),
      name: namedOf(inputs.name),
      hypothesis: textOf(inputs.hypothesis),
      config: textOf(inputs.config),
    });
  }
}
