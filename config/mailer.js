const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendOtpEmail(to, code) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Your Cad Dev SSO Login Code',
    text: `Your login code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <span style="font-size:40px">🔐</span>
          <h2 style="margin:12px 0 4px;font-size:20px">Cad Dev SSO</h2>
          <p style="color:#94a3b8;margin:0">Your login code</p>
        </div>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
          <p style="font-size:40px;font-weight:700;letter-spacing:12px;color:#3b82f6;margin:0">${code}</p>
        </div>
        <p style="text-align:center;color:#64748b;font-size:13px;margin:0">
          Expires in <strong style="color:#94a3b8">10 minutes</strong> &nbsp;·&nbsp; One-time use only<br><br>
          If you did not request this, ignore this email.
        </p>
      </div>
    `
  });
}

module.exports = { sendOtpEmail };
