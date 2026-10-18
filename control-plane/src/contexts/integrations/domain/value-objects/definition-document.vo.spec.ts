import { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import { describe, expect, it } from 'vitest';

describe('DefinitionDocument', () => {
  it('says what a field contains', () => {
    const document = DefinitionDocument.of({ key: 'delivery' });

    expect(document.hasValue('key', 'delivery')).toBe(true);
    expect(document.hasValue('key', 'review')).toBe(false);
    expect(document.hasValue('name', 'delivery')).toBe(false);
  });

  it('keeps a copy that nothing can change afterwards', () => {
    const written = { key: 'delivery', stations: [{ key: 'backlog' }] };
    const document = DefinitionDocument.of(written);

    written.stations[0] = { key: 'changed' };

    expect(document.fields).toEqual({
      key: 'delivery',
      stations: [{ key: 'backlog' }],
    });
    expect(Object.isFrozen(document.fields.stations)).toBe(true);
  });

  it('rejects what is not a document of fields', () => {
    expect(() => DefinitionDocument.of('delivery')).toThrow(/document/);
    expect(() => DefinitionDocument.of([])).toThrow(/document/);
    expect(() => DefinitionDocument.of(null)).toThrow(/document/);
  });

  it('is equal to another that says the same', () => {
    expect(
      DefinitionDocument.of({ key: 'a' }).equals(
        DefinitionDocument.of({ key: 'a' }),
      ),
    ).toBe(true);
  });

  it('is equal to another that says the same in another order, as one stored in the database is', () => {
    expect(
      DefinitionDocument.of({ key: 'a', mcp: { url: 'u', auth: {} } }).equals(
        DefinitionDocument.of({ mcp: { auth: {}, url: 'u' }, key: 'a' }),
      ),
    ).toBe(true);
    expect(
      DefinitionDocument.of({ key: 'a' }).equals(
        DefinitionDocument.of({ key: 'b' }),
      ),
    ).toBe(false);
  });
});
