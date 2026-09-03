export default function getDesignedEmail({
  otp,
  firstName = "there",
  brandName = "Your Company",
  supportEmail = "support@example.com",
  actionUrl,
  preheader,
  colors = {},
}) {
  const accent = colors.accent || "#fa812f";
  const primary = colors.primary || "#fef3e2";
  const secondary = colors.secondary || "#393e46";

  const safeOtp = String(otp || "").replace(/\s+/g, "");
  const preheaderText =
    preheader ||
    `Your one-time passcode is ${safeOtp}. It expires in 10 minutes.`;

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; background-color: ${primary}; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
          <h2 style="color: ${secondary};">Password Reset Request</h2>
          <p>Hi ${firstName},</p>
          <p>Your one-time OTP for password reset is:</p>
          <h1 style="color: ${accent}; letter-spacing: 4px;">${safeOtp}</h1>
          <p>${preheaderText}</p>
          <p>If you need help, contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
        </div>
      </body>
    </html>
  `;
}