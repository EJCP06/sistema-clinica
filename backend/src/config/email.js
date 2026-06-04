const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const enviarCorreoOTP = async (destinatario, codigo) => {
  const mailOptions = {
    from: `"Clínica Nueva Caracas" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: 'Código de recuperación - Clínica Nueva Caracas',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #1e293b; margin: 0;">Clínica Nueva Caracas</h1>
          <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Recuperación de contraseña</p>
        </div>
        <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">Tu código de verificación es:</p>
        <div style="text-align: center; background: #f1f5f9; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
          <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #2563eb;">${codigo}</span>
        </div>
        <p style="font-size: 12px; color: #64748b;">Este código expirará en 5 minutos. Si no solicitaste este cambio, ignora este correo.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 10px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} Clínica Nueva Caracas</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { enviarCorreoOTP };
