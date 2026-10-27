import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { InvalidVoiceError } from '@work/domain/exceptions/invalid-voice.error';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

describe('Voice', () => {
  it('is a station speaking, with or without a run behind it', () => {
    expect(Voice.station().run).toBeNull();
    expect(Voice.station(RunId.of('run_1')).run?.value).toBe('run_1');
    expect(Voice.station().author).toBeNull();
  });

  it('is a person speaking, who has a name', () => {
    const person = Voice.person(UserId.of('user_1'));

    expect(person.isPerson).toBe(true);
    expect(person.author?.value).toBe('user_1');
    expect(person.run).toBeNull();
  });

  it('is a person speaking with co-authors, each named once and not twice for the author', () => {
    const person = Voice.person(UserId.of('user_1'), [
      UserId.of('user_2'),
      UserId.of('user_1'),
      UserId.of('user_2'),
      UserId.of('user_3'),
    ]);

    expect(person.coAuthors.map((each) => each.value)).toEqual([
      'user_2',
      'user_3',
    ]);
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

    it('rejects a person nobody can name', () => {
      expect(() => Voice.of({ by: 'person' })).toThrow(InvalidVoiceError);
    });

    it('rejects a name on a voice that is not a person’s', () => {
      expect(() => Voice.of({ by: 'world', author: 'user_1' })).toThrow(
        InvalidVoiceError,
      );
      expect(() => Voice.of({ by: 'station', author: 'user_1' })).toThrow(
        InvalidVoiceError,
      );
    });

    it('takes back the co-authors of a person', () => {
      expect(
        Voice.of({ by: 'person', author: 'user_1', coAuthors: ['user_2'] })
          .coAuthors[0]?.value,
      ).toBe('user_2');
    });

    it('rejects co-authors on a voice that is not a person’s', () => {
      expect(() => Voice.of({ by: 'station', coAuthors: ['user_2'] })).toThrow(
        InvalidVoiceError,
      );
    });

    it('rejects a run behind a voice the station did not speak', () => {
      expect(() => Voice.of({ by: 'world', run: 'run_1' })).toThrow(
        InvalidVoiceError,
      );
    });

    it('rejects a voice that it does not know', () => {
      expect(() => Voice.of({ by: 'nobody' })).toThrow(InvalidVoiceError);
    });
  });
});
