let resendClient = null;

if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = require("resend");
    resendClient = new Resend(process.env.RESEND_API_KEY);
    console.log("📧 Resend Email Notification Service: ACTIVE");
  } catch (err) {
    console.warn("Could not initialize Resend:", err.message);
  }
} else {
  console.log("ℹ️ RESEND_API_KEY not configured. Email notifications will be logged in development mode.");
}

const FROM_EMAIL = process.env.RESEND_FROM || "uxcribe-gantt <onboarding@resend.dev>";

class EmailService {
  async sendEmail({ to, subject, html }) {
    if (resendClient) {
      try {
        const result = await resendClient.emails.send({
          from: FROM_EMAIL,
          to: Array.isArray(to) ? to : [to],
          subject,
          html
        });
        console.log(`✉️ Email successfully sent to ${to} via Resend. ID:`, result.data?.id || result.id);
        return { success: true, result };
      } catch (err) {
        console.error(`❌ Error sending email to ${to} via Resend:`, err.message);
        return { success: false, error: err.message };
      }
    } else {
      console.log(`\n================== [SIMULATED EMAIL NOTIFICATION] ==================`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`HTML Body:\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)}...`);
      console.log(`====================================================================\n`);
      return { success: true, simulated: true };
    }
  }

  async sendProjectInvitation({ toEmail, inviterName, projectName, role, inviteUrl, isNewUser }) {
    const roleLabel = role === "ADMIN" ? "Administrador" : (role === "VIEWER" ? "Lector" : "Editor");
    const actionText = isNewUser ? "Crear Cuenta y Ver Proyecto" : "Abrir Carta Gantt";

    const html = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:#f8fafc; padding:32px 16px; color:#1e293b;">
        <div style="max-width:540px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <div style="background:#0f172a; padding:24px; text-align:center;">
            <div style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
              uxcribe<span style="color:#0ea5e9;">-gantt</span>
            </div>
          </div>
          <div style="padding:32px 28px;">
            <h2 style="margin:0 0 16px; font-size:18px; color:#0f172a; font-weight:700;">
              ¡Has sido invitado a colaborar!
            </h2>
            <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px;">
              <strong>${inviterName}</strong> te ha invitado a colaborar en la carta Gantt del proyecto <strong>"${projectName}"</strong> con el rol de <strong>${roleLabel}</strong>.
            </p>
            <div style="background:#f1f5f9; border-radius:8px; padding:16px; margin:0 0 24px; border-left:4px solid #0284c7;">
              <div style="font-size:13px; font-weight:600; color:#334155;">Proyecto: ${projectName}</div>
              <div style="font-size:12px; color:#64748b; margin-top:4px;">Rol asignado: ${roleLabel}</div>
            </div>
            <div style="text-align:center; margin:28px 0;">
              <a href="${inviteUrl}" style="display:inline-block; background:#0284c7; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:6px; font-size:14px; font-weight:600; box-shadow:0 2px 6px rgba(2,132,199,0.3);">
                ${actionText}
              </a>
            </div>
            <p style="font-size:12px; color:#94a3b8; line-height:1.5; margin:24px 0 0; border-top:1px solid #f1f5f9; padding-top:16px;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="${inviteUrl}" style="color:#0284c7; word-break:break-all;">${inviteUrl}</a>
            </p>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: toEmail,
      subject: `${inviterName} te invitó al proyecto "${projectName}" en uxcribe-gantt`,
      html
    });
  }

  async sendWorkspaceInvitation({ toEmail, inviterName, workspaceName, role, inviteUrl, isNewUser }) {
    const roleLabel = role === "ADMIN" ? "Administrador" : "Colaborador";
    const actionText = isNewUser ? "Crear Cuenta y Unirse al Espacio" : "Ir al Espacio de Trabajo";

    const html = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background:#f8fafc; padding:32px 16px; color:#1e293b;">
        <div style="max-width:540px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
          <div style="background:#0f172a; padding:24px; text-align:center;">
            <div style="font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">
              uxcribe<span style="color:#0ea5e9;">-gantt</span>
            </div>
          </div>
          <div style="padding:32px 28px;">
            <h2 style="margin:0 0 16px; font-size:18px; color:#0f172a; font-weight:700;">
              Invitación a Espacio de Trabajo
            </h2>
            <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px;">
              <strong>${inviterName}</strong> te ha invitado a unirte al espacio de trabajo <strong>"${workspaceName}"</strong> en uxcribe-gantt. Tendrás acceso a todos los proyectos y cartas Gantt del equipo.
            </p>
            <div style="text-align:center; margin:28px 0;">
              <a href="${inviteUrl}" style="display:inline-block; background:#0284c7; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:6px; font-size:14px; font-weight:600;">
                ${actionText}
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: toEmail,
      subject: `${inviterName} te invitó al espacio de trabajo "${workspaceName}"`,
      html
    });
  }
}

module.exports = new EmailService();
