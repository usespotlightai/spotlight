import { describe, expect, it } from 'vitest';

import type { TaskHoldResponseDto, TaskResponseDto } from '@/lib/api';
import { MAYA, SAM } from '@/mocks/world/people';
import { reviewAnswered } from '@/mocks/world/waiting-for-you';
import { partial } from '@/test/partial';

const asked = (over: Partial<TaskResponseDto> = {}) =>
  partial<TaskResponseDto>({
    id: 'task_1',
    assignee: null,
    hold: null,
    awaitingReview: partial<NonNullable<TaskResponseDto['awaitingReview']>>({
      conversationId: 'task_1:0',
    }),
    ...over,
  });

describe('reviewAnswered', () => {
  it('assigns a task with no assignee to the viewer who answers, as the server does', () => {
    const task = asked();

    reviewAnswered(task, [], 'task_1:0');

    expect(task.assignee).toEqual(SAM);
    expect(task.awaitingReview).toBeNull();
  });

  it('keeps the assignee of an assigned task, and assigns no task that a person holds', () => {
    const assigned = asked({ assignee: MAYA });
    const held = asked({
      hold: partial<TaskHoldResponseDto>({ chatId: null }),
    });

    reviewAnswered(assigned, [], 'task_1:0');
    reviewAnswered(held, [], 'task_1:0');

    expect(assigned.assignee).toEqual(MAYA);
    expect(held.assignee).toBeNull();
  });

  it('assigns nothing when the answer is for another conversation', () => {
    const task = asked();

    reviewAnswered(task, [], 'task_1:4');

    expect(task.assignee).toBeNull();
  });
});
