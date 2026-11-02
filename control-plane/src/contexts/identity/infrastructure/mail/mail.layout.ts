import { escaped } from '@identity/infrastructure/mail/mail.format';

const FONT =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export interface MailLayout {
  readonly appUrl: string;
  readonly heading: string;
  readonly lead: string;
  readonly detail: string;
  readonly action: { readonly label: string; readonly href: string };
  readonly footnote: string;
}

export const mailLayout = ({
  appUrl,
  heading,
  lead,
  detail,
  action,
  footnote,
}: MailLayout): string => {
  const href = escaped(action.href);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
    <style>
      a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    </style>
  </head>
  <body style="margin:0;padding:40px 16px;background:#efeff1;font-family:${FONT};color:#2f2f31;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:0 auto;background:#fefeff;border:1px solid #e4e4e6;border-radius:14px;">
      <tr>
        <td style="padding:32px;">
          <img src="${escaped(appUrl)}/email-logo.png" width="98" height="20" alt="Spotlight" style="display:block;border:0;margin:0 0 32px;">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;font-weight:600;letter-spacing:-0.01em;color:#2f2f31;">
            ${heading}
          </h1>
          <p style="margin:0 0 8px;font-size:14px;line-height:22px;color:#2f2f31;">
            ${lead}
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#5b5b5d;">
            ${detail}
          </p>
          <a href="${href}"
             style="display:inline-block;padding:8px 16px;border-radius:999px;background:#6d78d5;color:#fefeff;font-size:14px;line-height:20px;font-weight:500;text-decoration:none;">
            ${action.label}
          </a>
          <p style="margin:32px 0 0;padding-top:20px;border-top:1px solid #e4e4e6;font-size:12px;line-height:18px;color:#757578;">
            ${footnote}
          </p>
          <p style="margin:8px 0 0;font-size:12px;line-height:18px;word-break:break-all;">
            <a href="${href}" style="color:#757578;text-decoration:underline;">${href}</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
