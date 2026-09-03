import path from "node:path";
import ejs from "ejs";

export type OtpEmailPurpose = "VERIFY_EMAIL" | "RESET_PASSWORD";

interface RenderOtpEmailParams {
  purpose: OtpEmailPurpose;
  appName: string;
  name: string;
  otp: string;
  expiresInMinutes: number;
}

interface OtpCopy {
  pageTitle: string;
  introText: string;
  safetyNote: string;
}

const OTP_COPY: Record<OtpEmailPurpose, OtpCopy> = {
  VERIFY_EMAIL: {
    pageTitle: "Verify your email",
    introText:
      "Use the code below to verify your email address and finish setting up your account.",
    safetyNote: "If you didn't request this, you can safely ignore this email.",
  },
  RESET_PASSWORD: {
    pageTitle: "Reset your password",
    introText: "Use the code below to reset your password.",
    safetyNote:
      "If you didn't request this, please secure your account immediately — someone may be trying to access it.",
  },
};

/**
 * Renders the shared OTP email template with copy tailored to the given purpose.
 * Add a new purpose by extending OtpEmailPurpose and OTP_COPY — the template itself
 * never needs to change.
 */
export async function renderOtpEmail(
  params: RenderOtpEmailParams,
): Promise<string> {
  const copy = OTP_COPY[params.purpose];

  return ejs.renderFile(path.join(process.cwd(), "src/app/templates/otp.ejs"), {
    appName: params.appName,
    name: params.name,
    otp: params.otp,
    expiresInMinutes: params.expiresInMinutes,
    currentYear: new Date().getFullYear(),
    pageTitle: copy.pageTitle,
    introText: copy.introText,
    safetyNote: copy.safetyNote,
  });
}
