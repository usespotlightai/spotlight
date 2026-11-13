import { actionNamed } from '@integrations/domain/value-objects/action.fake-spec';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { describe, expect, it } from 'vitest';

const UPLOADING = DefinedActions.of([
  actionNamed('post'),
  actionNamed('attach', { uploads: true }),
]);

describe('DefinedActions', () => {
  it('hands back an action it defines', () => {
    expect(UPLOADING.named('post', 'schedule').name).toBe('post');
  });

  it('rejects one it does not define', () => {
    expect(() => UPLOADING.named('digest', 'schedule')).toThrow(
      /names undefined action digest/,
    );
  });

  it('lets no tool or schedule name an action that uploads files', () => {
    expect(() =>
      UPLOADING.calledBy('attach', 'tool', 'tool linear.attach'),
    ).toThrow(
      /names the action attach, which uploads files. A tool has no files/,
    );
    expect(() => UPLOADING.calledBy('attach', 'schedule', 'schedule')).toThrow(
      /A schedule has no files/,
    );
    expect(UPLOADING.calledBy('post', 'tool', 'tool linear.post').name).toBe(
      'post',
    );
  });

  it('lets only a binding on an event that has files name an action that uploads them', () => {
    expect(() => UPLOADING.calledBy('attach', 'chat', 'binding')).toThrow(
      /A chat event has no files/,
    );
    expect(() =>
      UPLOADING.calledBy('attach', 'inbox-request', 'binding'),
    ).toThrow(/An inbox request event has no files/);
    expect(() => UPLOADING.calledBy('attach', 'notice', 'binding')).toThrow(
      /A notice event has no files/,
    );
    expect(UPLOADING.calledBy('attach', 'task', 'binding').name).toBe('attach');
  });
});
