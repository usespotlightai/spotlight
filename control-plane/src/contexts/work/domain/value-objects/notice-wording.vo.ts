import { InvalidNoticeError } from '@work/domain/exceptions/invalid-notice.error';

const MOST_HEADLINE = 200;

const MOST_POINTS = 20;

const MOST_POINT = 1_000;

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

    if (!headline || headline.length > MOST_HEADLINE) {
      throw new InvalidNoticeError(
        `headline must be 1 to ${MOST_HEADLINE} characters`,
      );
    }
    if (
      points.length === 0 ||
      points.length > MOST_POINTS ||
      points.some((each) => !each || each.length > MOST_POINT)
    ) {
      throw new InvalidNoticeError(
        `must make 1 to ${MOST_POINTS} points of 1 to ${MOST_POINT.toLocaleString('en-US')} characters each`,
      );
    }

    return new NoticeWording(headline, points);
  }
}
