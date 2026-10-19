export const MAX_GUIDANCE_LENGTH = 280;

export const judgeGuidanceOf = (
  guidance: string | null | undefined,
): string | null => {
  const text = guidance?.trim() ?? '';

  return text && text.length <= MAX_GUIDANCE_LENGTH && !/[\r\n]/.test(text)
    ? text
    : null;
};
