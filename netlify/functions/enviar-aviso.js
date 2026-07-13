// Función serverless (Netlify) que recibe el aviso del formulario
// y lo envía por email usando el SMTP de Strato (hmys.es).
//
// Variables de entorno necesarias (se configuran en el panel de Netlify,
// Site settings > Environment variables — NUNCA se escriben aquí en el código):
//
//   SMTP_USER      -> averias@hmys.es (el buzón que envía)
//   SMTP_PASS      -> la contraseña de ese buzón
//   AVISO_DESTINO  -> a qué dirección llega el aviso (puede ser la misma
//                     averias@hmys.es, o info@hmys.es, o varias separadas por coma)

const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'JSON inválido' };
  }

  const { ticketId, nombre, direccion, descripcion, fecha, photos = [], audio } = data;

  if (!nombre || !direccion) {
    return { statusCode: 400, body: 'Faltan datos obligatorios' };
  }

  // --- Preparamos adjuntos ---
  const attachments = [];

  photos.forEach((p, i) => {
    const match = /^data:(.+);base64,(.+)$/.exec(p.dataUrl);
    if (match) {
      attachments.push({
        filename: p.name || `foto-${i + 1}.jpg`,
        content: match[2],
        encoding: 'base64',
        contentType: match[1]
      });
    }
  });

  if (audio) {
    const match = /^data:(.+);base64,(.+)$/.exec(audio);
    if (match) {
      attachments.push({
        filename: 'nota-de-voz.webm',
        content: match[2],
        encoding: 'base64',
        contentType: match[1]
      });
    }
  }

  // --- Configuramos el transporte SMTP (Strato) ---
  const transporter = nodemailer.createTransport({
    host: 'smtp.strato.de',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const destino = process.env.AVISO_DESTINO || process.env.SMTP_USER;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 560px;">
      <div style="display:inline-block; background:#1C1F22; color:#E8630A; font-family:monospace; font-weight:bold; font-size:15px; padding:6px 14px; border-radius:6px; margin-bottom:12px;">
        Expediente ${ticketId || 'S/N'}
      </div>
      <h2 style="color:#E8630A; margin:8px 0 4px;">Nuevo aviso de avería</h2>
      <p style="color:#888; margin-top:0; font-size:13px;">${fecha || ''}</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#666; width:110px;">Nombre</td><td style="padding:6px 0;"><b>${escapeHtml(nombre)}</b></td></tr>
        <tr><td style="padding:6px 0; color:#666;">Dirección</td><td style="padding:6px 0;"><b>${escapeHtml(direccion)}</b></td></tr>
      </table>
      ${descripcion ? `<p style="white-space:pre-wrap;">${escapeHtml(descripcion)}</p>` : '<p style="color:#888;">(Sin descripción escrita — revisar fotos/audio adjuntos)</p>'}
      <p style="color:#888; font-size:13px; margin-top:20px;">
        ${photos.length ? `📷 ${photos.length} foto(s) adjunta(s).` : ''}
        ${audio ? ' 🎙️ Nota de voz adjunta.' : ''}
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Avisos HMYS" <${process.env.SMTP_USER}>`,
      to: destino,
      replyTo: process.env.SMTP_USER,
      subject: `[${ticketId || 'S/N'}] Nuevo aviso — ${direccion}`,
      html: htmlBody,
      attachments
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
