import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { NoteFiles } from '@work/application/services/note-files.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-03T10:00:00.000Z');

const SHOT = Attachment.of({
  id: 'file_1',
  name: 'shot.png',
  contentType: 'image/png',
  size: 3,
});

const delivery = () =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of('station_1'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const asked = () =>
  Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => 'task_1',
  }).askedAbout(
    {
      station: null,
      body: TaskNoteBody.of('Here are the screenshots.'),
      at: NOW,
      voice: Voice.station(),
      attachments: [SHOT],
    },
    null,
  );

const noteFiles = (task: Task | null) => {
  const open = vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    contentType: 'image/png',
  }));
  const find = vi.fn(async (_id: TaskId) => task);

  return {
    files: new NoteFiles(
      { find } as unknown as TaskRepository,
      { open } as unknown as AttachmentStorePort,
    ),
    open,
    find,
  };
};

describe('NoteFiles', () => {
  it('opens a file of the task, in the task’s workspace', async () => {
    const { files, open, find } = noteFiles(asked());

    expect(await files.open('task_1', 'file_1')).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(find).toHaveBeenCalledWith(TaskId.of('task_1'));
    expect(open).toHaveBeenCalledWith(WorkspaceId.of('ws_1'), SHOT);
  });

  it('opens nothing that is not a file of the task', async () => {
    const { files, open } = noteFiles(asked());

    expect(await files.open('task_1', 'file_9')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens nothing for a task it cannot find', async () => {
    const { files, open } = noteFiles(null);

    expect(await files.open('task_9', 'file_1')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});
