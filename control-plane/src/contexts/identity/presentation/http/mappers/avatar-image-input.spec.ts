import { avatarImageInput } from '@identity/presentation/http/mappers/avatar-image-input';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { describe, expect, it } from 'vitest';

const input = (data: unknown) =>
  avatarImageInput({ contentType: 'image/png', data } as never);

describe('avatarImageInput', () => {
  it('decodes base64', () => {
    expect(Array.from(input('AQID').bytes)).toEqual([1, 2, 3]);
    expect(Array.from(input('AQI=').bytes)).toEqual([1, 2]);
  });

  it.each(['AQ*D', 'AQI', 'AQ ID', 'AQ==AQID', 42])(
    'refuses %j with 422',
    (data) => {
      const refused = (() => {
        try {
          input(data);
          return null;
        } catch (error) {
          return error;
        }
      })();

      expect(refused).toBeInstanceOf(ProblemException);
      expect((refused as ProblemException).getStatus()).toBe(422);
    },
  );
});
