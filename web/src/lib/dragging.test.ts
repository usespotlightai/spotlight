import { describe, expect, it } from 'vitest';
import { landingFor, reordered } from '@/lib/dragging';
import type { Task } from '@/lib/task';

const task = (id: string, stationId: string): Task => ({
  id,
  stationId,
  title: id,
  description: null,
  createdAt: '2026-08-04T09:15:00.000Z',
  running: false,
  awaitingReview: null,
  raisedBy: null,
  repository: null,
  pullRequest: null,
  note: null,
});

const board = [task('a', 'triage'), task('b', 'triage'), task('c', 'spec')];

describe('landingFor', () => {
  it('takes the place of a task it was dragged down onto', () => {
    expect(
      landingFor(board, 'a', { kind: 'task', id: 'b', stationId: 'triage' }),
    ).toEqual({ stationId: 'triage', afterTaskId: 'b' });
  });

  it('takes the place of a task it was dragged up onto', () => {
    expect(
      landingFor(board, 'b', { kind: 'task', id: 'a', stationId: 'triage' }),
    ).toEqual({ stationId: 'triage', afterTaskId: null });
  });

  it('lands above the task it was dropped on, coming from elsewhere', () => {
    expect(
      landingFor(board, 'c', { kind: 'task', id: 'b', stationId: 'triage' }),
    ).toEqual({ stationId: 'triage', afterTaskId: 'a' });
  });

  it('goes to the end when let go over a station itself', () => {
    expect(
      landingFor(board, 'c', {
        kind: 'station',
        id: 'triage',
        stationId: 'triage',
      }),
    ).toEqual({ stationId: 'triage', afterTaskId: 'b' });
  });

  it('lands first in a station holding nothing', () => {
    expect(
      landingFor(board, 'a', {
        kind: 'station',
        id: 'review',
        stationId: 'review',
      }),
    ).toEqual({ stationId: 'review', afterTaskId: null });
  });

  it('leaves itself out when dropped on its own station', () => {
    expect(
      landingFor(board, 'b', {
        kind: 'station',
        id: 'triage',
        stationId: 'triage',
      }),
    ).toEqual({ stationId: 'triage', afterTaskId: 'a' });
  });
});

describe('reordered', () => {
  it('moves a station down the line', () => {
    expect(reordered(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('moves a station up the line', () => {
    expect(reordered(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('leaves the line alone when nothing moved', () => {
    expect(reordered(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c']);
  });
});
