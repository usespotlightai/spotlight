import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { NowhereToOpenAPullRequestError } from '@work/domain/exceptions/nowhere-to-open-a-pull-request.error';
import { chatPullRequestPlacement } from '@work/domain/services/chat-pull-request-placement';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { describe, expect, it } from 'vitest';

const WEB = Repository.of('acme/web');
const API = Repository.of('acme/api');

const lineOf = (
  key: string,
  repositories: readonly Repository[],
  opensPullRequests = true,
) =>
  lineMapOf({
    id: LineId.of(`line_${key}`),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of(key),
    name: LineName.of(key),
    repositories: repositories.map((each) => repositoryOf(each)),
    stations: [
      stationOf({
        id: StationId.of(`station_${key}_backlog`),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of(`station_${key}_build`),
        key: StationKey.of('build'),
        name: StationName.of('Build'),
        position: 1,
        color: '#a3a8b0',
        harness: HarnessId.of('dev'),
      }),
      stationOf({
        id: StationId.of(`station_${key}_ship`),
        key: StationKey.of('ship'),
        name: StationName.of('Ship'),
        position: 2,
        color: '#a3a8b0',
        harness: HarnessId.of('dev'),
        tools: opensPullRequests ? [Tool.of('pull-request')] : [],
      }),
      stationOf({
        id: StationId.of(`station_${key}_completed`),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 3,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

describe('where a chat’s pull request waits', () => {
  it('waits at the station that opens pull requests, on the one line that works on the repository', () => {
    const placement = chatPullRequestPlacement(
      [lineOf('delivery', [WEB]), lineOf('backend', [API])],
      WEB,
      null,
    );

    expect(placement.line.key.value).toBe('delivery');
    expect(placement.station.key.value).toBe('ship');
  });

  it('waits on the line the agent names', () => {
    expect(
      chatPullRequestPlacement(
        [lineOf('delivery', [WEB]), lineOf('hotfix', [WEB])],
        WEB,
        ' hotfix ',
      ).line.key.value,
    ).toBe('hotfix');
  });

  it('refuses a named line that does not work on the repository', () => {
    expect(() =>
      chatPullRequestPlacement([lineOf('backend', [API])], WEB, 'backend'),
    ).toThrow(/does not work on acme\/web/);
  });

  it('asks for a line when more than one works on the repository', () => {
    expect(() =>
      chatPullRequestPlacement(
        [lineOf('delivery', [WEB]), lineOf('hotfix', [WEB])],
        WEB,
        null,
      ),
    ).toThrow(
      /more than one line works on acme\/web; name one with --line \(delivery, hotfix\)/,
    );
  });

  it('names the lines when none works on the repository', () => {
    expect(() =>
      chatPullRequestPlacement([lineOf('backend', [API])], WEB, null),
    ).toThrow(/no line that works on acme\/web .*the lines are: backend/);
  });

  it('refuses a line with no station that opens pull requests, and a line that is not there', () => {
    const lines = [lineOf('delivery', [WEB], false)];

    expect(() => chatPullRequestPlacement(lines, WEB, 'delivery')).toThrow(
      NowhereToOpenAPullRequestError,
    );
    expect(() => chatPullRequestPlacement(lines, WEB, 'ops')).toThrow(
      /there is no line "ops"/,
    );
  });
});
