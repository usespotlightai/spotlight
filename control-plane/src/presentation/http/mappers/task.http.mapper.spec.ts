import type { TaskDto } from '@application/dto/task.dto';
import { TaskHttpMapper } from '@presentation/http/mappers/task.http.mapper';
import { describe, expect, it } from 'vitest';

const dto: TaskDto = {
  id: 'task_1',
  stationId: 'station_1',
  title: 'Fix the queue',
  description: '## Steps',
  attachments: [
    { id: 'file_1', name: 'queue.png', contentType: 'image/png', size: 4096 },
  ],
  createdAt: '2026-08-28T09:15:00.000Z',
  running: true,
  awaitingReview: null,
  pullRequest: null,
  raisedBy: { id: 'user_1', name: 'Ada', image: null },
  assignee: null,
  note: {
    position: 0,
    station: 'Implementation',
    body: 'Given up on after 3 attempts.',
  },
};

describe('TaskHttpMapper', () => {
  it('carries every field a task has, whatever gets added later', () => {
    const response = TaskHttpMapper.toResponse(dto);

    expect(Object.keys(response).sort()).toEqual(Object.keys(dto).sort());
    for (const key of Object.keys(dto) as (keyof TaskDto)[]) {
      expect(
        response[key],
        `${key} was dropped crossing to the response`,
      ).not.toBeUndefined();
    }
  });

  it('carries the note as its own shape, not as words', () => {
    const response = TaskHttpMapper.toResponse(dto);

    expect(response.note).toEqual({
      position: 0,
      station: 'Implementation',
      body: 'Given up on after 3 attempts.',
    });
  });

  it('keeps a task nobody has said anything about noteless', () => {
    expect(TaskHttpMapper.toResponse({ ...dto, note: null }).note).toBeNull();
  });
});
