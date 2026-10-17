type Invalid = new (reason: string) => Error;

export const WrittenText = {
  prose(written: string, max: number, Invalid: Invalid): string {
    const said = written.trim();

    if (!said) {
      throw new Invalid('must not be empty');
    }
    if (said.length > max) {
      throw new Invalid(`must be at most ${max} characters`);
    }

    return written;
  },

  oneLine(written: string, max: number, Invalid: Invalid): string {
    const said = written.trim();

    if (!said || said.length > max || /[\r\n]/.test(said)) {
      throw new Invalid(`is one line of at most ${max} characters`);
    }

    return written;
  },
};
