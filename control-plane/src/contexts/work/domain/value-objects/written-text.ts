type Invalid = new (reason: string) => Error;

export const WrittenText = {
  prose(written: string, most: number, Invalid: Invalid): string {
    const said = written.trim();

    if (!said) {
      throw new Invalid('must not be empty');
    }
    if (said.length > most) {
      throw new Invalid(`must be at most ${most} characters`);
    }

    return written;
  },

  oneLine(written: string, most: number, Invalid: Invalid): string {
    const said = written.trim();

    if (!said || said.length > most || /[\r\n]/.test(said)) {
      throw new Invalid(`is one line of at most ${most} characters`);
    }

    return written;
  },
};
