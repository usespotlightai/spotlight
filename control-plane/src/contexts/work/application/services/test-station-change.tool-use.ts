import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import {
  STATION_CHANGE_TEST_MODES,
  type StationChangeTestMode,
  type StationChangeTestsPort,
} from '@work/application/ports/station-change-tests.port';
import { StationChangeTestAnswer } from '@work/application/rendering/station-change-test-answer';
import type { BuiltInToolUse } from '@work/application/services/built-in-tools.service';
import { UnknownChatError } from '@work/domain/exceptions/unknown-chat.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { TEST_STATION_CHANGE } from '@work/domain/services/built-in-tools';
import type { TargetStation } from '@work/domain/value-objects/target-station.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';

const isMode = (raw: string): raw is StationChangeTestMode =>
  (STATION_CHANGE_TEST_MODES as readonly string[]).includes(raw);

const named = (inputs: ToolInputs, name: string): string | null =>
  inputs.text(name)?.trim() || null;

const blockOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isOther = (inputs: ToolInputs, target: TargetStation): boolean => {
  const line = named(inputs, 'line');
  const station = named(inputs, 'station');

  return (
    (line !== null && line !== target.lineKey.value) ||
    (station !== null && station !== target.stationKey.value)
  );
};

export class TestStationChangeToolUse
  implements BuiltInToolUse<ChatToolContext>
{
  readonly tool = TEST_STATION_CHANGE;

  constructor(
    private readonly chats: ChatRepository,
    private readonly tests: StationChangeTestsPort,
  ) {}

  async call(
    { chatId, workspaceId }: ChatToolContext,
    inputs: ToolInputs,
  ): Promise<unknown> {
    const chat = await this.chats.find(chatId);

    if (!chat) {
      throw new UnknownChatError(chatId.value);
    }

    const target = chat.targetStation;

    if (!target) {
      return StationChangeTestAnswer.refused(
        'not-improving',
        'This chat does not improve a station.',
      );
    }
    if (isOther(inputs, target)) {
      return StationChangeTestAnswer.refused(
        'other-station',
        `This chat improves only the ${target.stationName.value} station (${target.stationKey.value}) on the ${target.lineName.value} line (${target.lineKey.value}).`,
      );
    }

    const mode = named(inputs, 'mode') ?? 'test';

    if (!isMode(mode)) {
      return StationChangeTestAnswer.refused(
        'invalid-mode',
        `Mode ${mode} is not known. Use test or search.`,
      );
    }

    return StationChangeTestAnswer.of(
      await this.tests.request({
        workspaceId,
        teamId: target.teamId,
        lineId: target.lineId.value,
        stationId: target.stationId.value,
        requester: chat.startedBy,
        mode,
        name: named(inputs, 'name') ?? '',
        hypothesis: inputs.text('hypothesis') ?? '',
        block: blockOf(inputs.text('config') ?? ''),
      }),
    );
  }
}
