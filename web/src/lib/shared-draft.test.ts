import { describe, expect, it } from 'vitest';
import { Doc } from 'yjs';
import {
  collabUrl,
  colorOf,
  draftParts,
  taskDraftName,
} from '@/lib/shared-draft';

describe('shared drafts', () => {
  it('names the draft of a task the way the control plane does', () => {
    expect(taskDraftName('task_1')).toBe('task-draft:task_1');
  });

  it('connects over the same host, secure when the page is', () => {
    expect(
      collabUrl({ protocol: 'https:', host: 'app.example.com' } as Location),
    ).toBe('wss://app.example.com/api/collab');
    expect(
      collabUrl({ protocol: 'http:', host: 'localhost:5173' } as Location),
    ).toBe('ws://localhost:5173/api/collab');
  });

  it('gives a person the same colour every time', () => {
    expect(colorOf('user_1')).toBe(colorOf('user_1'));
  });

  it('keeps the generation, writers and attachments where the control plane reads them', () => {
    const doc = new Doc();
    const { meta, writers, attachments } = draftParts(doc);

    meta.set('generation', 2);
    writers.set('user_1', true);
    attachments.push([
      { key: 'k', id: 'file_1', name: 'a.png', size: 1, image: true },
    ]);

    expect(doc.getMap('meta').get('generation')).toBe(2);
    expect([...doc.getMap('writers').keys()]).toEqual(['user_1']);
    expect(doc.getArray('attachments').length).toBe(1);
  });
});
