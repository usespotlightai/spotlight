type Invalid = new (reason: string) => Error;

export const WrittenText = {
  prose(written: string, max: number, Invalid: Invalid): string {
    const text = written.trim();

    if (!text) {
      throw new Invalid('must not be empty');
    }
    if (text.length > max) {
      throw new Invalid(`must be at most ${max} characters`);
    }

    return written;
  },

  oneLine(written: string, max: number, Invalid: Invalid): string {
    const text = written.trim();

    if (!text || text.length > max || /[\r\n]/.test(text)) {
      throw new Invalid(`is one line of at most ${max} characters`);
    }

    return written;
  },
};
