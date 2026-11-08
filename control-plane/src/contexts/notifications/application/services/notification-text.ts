const TITLE_LENGTH = 120;
const BODY_LENGTH = 240;

const shortened = (text: string, length: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim();

  return flat.length > length
    ? `${flat.slice(0, length - 1).trimEnd()}…`
    : flat;
};

export class NotificationText {
  private constructor(
    readonly title: string,
    readonly body: string | null,
  ) {}

  static of(title: string, body: string | null): NotificationText {
    const shortBody = body === null ? '' : shortened(body, BODY_LENGTH);

    return new NotificationText(
      shortened(title, TITLE_LENGTH) || 'Spotlight',
      shortBody === '' ? null : shortBody,
    );
  }
}
