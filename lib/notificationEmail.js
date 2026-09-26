import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 2525,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendNotificationEmail = async ({
  to,
  firstName = "Customer",
  title,
  message,
}) => {
  try {
    const mailOptions = {
      from: `"Crystal Beauty Clear" <f.afsaarif565@gmail.com>`,
      to,
      subject: title,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #E3FCF9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px;">
              
              <h2 style="color: #324F78;">
                Crystal Beauty Clear
              </h2>

              <p style="color: #334155;">
                Hi ${firstName},
              </p>

              <h3 style="color: #5067AA;">
                ${title}
              </h3>

              <p style="color: #475569; line-height: 1.6;">
                ${message}
              </p>

              <p style="color: #64748B; margin-top: 30px;">
                Thank you for choosing Crystal Beauty Clear.
              </p>

            </div>
          </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ Notification email sent successfully to ${to}`);

    return true;
  } catch (error) {
    console.error(
      "⚠️ Notification email error:",
      error.message
    );

    return false;
  }
};