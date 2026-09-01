import { InvalidVoiceError } from '@domain/exceptions/invalid-voice.error';
import { RunId } from '@domain/value-objects/run-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

describe('Voice', () => {
  it('is a station speaking, with or without a run behind it', () => {
    expect(Voice.station().run).toBeNull();
    expect(Voice.station(RunId.of('run_1')).run?.value).toBe('run_1');
    expect(Voice.station().author).toBeNull();
  });

  it('is a person speaking, who has a name', () => {
    const spoke = Voice.person(UserId.of('user_1'));

    expect(spoke.isPerson).toBe(true);
    expect(spoke.author?.value).toBe('user_1');
    expect(spoke.run).toBeNull();
  });

  it('is the world speaking, which is nobody of ours', () => {
    expect(Voice.world().author).toBeNull();
    expect(Voice.world().run).toBeNull();
  });

  describe('read back from storage', () => {
    it('takes the three back apart', () => {
      expect(Voice.of({ by: 'person', author: 'user_1' }).isPerson).toBe(true);
      expect(Voice.of({ by: 'world' }).isWorld).toBe(true);
      expect(Voice.of({ by: 'station', run: 'run_1' }).run?.value).toBe(
        'run_1',
      );
    });

    it('refuses a person nobody can name', () => {
      expect(() => Voice.of({ by: 'person' })).toThrow(InvalidVoiceError);
    });

    it('refuses a name on a voice that is not a person’s', () => {
      expect(() => Voice.of({ by: 'world', author: 'user_1' })).toThrow(
        InvalidVoiceError,
      );
      expect(() => Voice.of({ by: 'station', author: 'user_1' })).toThrow(
        InvalidVoiceError,
      );
    });

    it('refuses a run behind a voice the station did not speak', () => {
      expect(() => Voice.of({ by: 'world', run: 'run_1' })).toThrow(
        InvalidVoiceError,
      );
    });

    it('refuses a voice it has never heard of', () => {
      expect(() => Voice.of({ by: 'nobody' })).toThrow(InvalidVoiceError);
    });
  });
});
