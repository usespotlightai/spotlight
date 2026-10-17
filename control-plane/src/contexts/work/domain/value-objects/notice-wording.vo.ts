import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';

const MAX_HEADLINE = 200;

const MAX_POINTS = 20;

const MAX_POINT = 1_000;

export class NoticeWording {
  private constructor(
    readonly headline: string,
    readonly points: readonly string[],
  ) {}

  static of(input: {
    headline: string;
    points: readonly string[];
  }): NoticeWording {
    const headline = input.headline.trim();
    const points = input.points.map((each) => each.trim());

    if (!headline || headline.length > MAX_HEADLINE) {
      throw new InvalidNoticeError(
        `headline must be 1 to ${MAX_HEADLINE} characters`,
      );
    }
    if (
      points.length === 0 ||
      points.length > MAX_POINTS ||
      points.some((each) => !each || each.length > MAX_POINT)
    ) {
      throw new InvalidNoticeError(
        `must make 1 to ${MAX_POINTS} points of 1 to ${MAX_POINT.toLocaleString('en-US')} characters each`,
      );
    }

    return new NoticeWording(headline, points);
  }
}
