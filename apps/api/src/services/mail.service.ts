import nodemailer, { type Transporter } from 'nodemailer';
import config from '@school/config';

/** Rôle du titulaire du compte, tel qu'utilisé pour personnaliser l'email. */
export type AccountRole = 'STUDENT' | 'PARENT' | 'TEACHER';

interface RoleCopy {
  /** Libellé affiché dans l'email (ex. « espace élève »). */
  spaceLabel: string;
  /** Intro spécifique au rôle. */
  intro: string;
  /** Couleur d'accent (doit rester une valeur hexa fixe : pas de variables CSS en email). */
  accent: string;
  accentSoft: string;
}

const ROLE_COPY: Record<AccountRole, RoleCopy> = {
  STUDENT: {
    spaceLabel: 'espace élève',
    intro: "Un compte d'accès à votre espace élève HorizonEcole vient d'être créé.",
    accent: '#293770',
    accentSoft: '#EEF1FA',
  },
  PARENT: {
    spaceLabel: 'espace parent',
    intro: "Un compte d'accès à votre espace parent HorizonEcole vient d'être créé afin de suivre la scolarité de votre enfant.",
    accent: '#217A54',
    accentSoft: '#EAF5F0',
  },
  TEACHER: {
    spaceLabel: 'espace enseignant',
    intro: "Un compte d'accès à votre espace enseignant HorizonEcole vient d'être créé.",
    accent: '#A66C1B',
    accentSoft: '#FDF3E4',
  },
};

let transporter: Transporter | null = null;
let transporterConfigured = false;

/**
 * Construit (une seule fois) le transporteur SMTP à partir de la config
 * `@school/config`. Retourne `null` si l'hôte/identifiants ne sont pas
 * renseignés (ex. environnement de dev/test sans SMTP) : dans ce cas l'appelant
 * doit se contenter de logger et poursuivre (envoi best-effort, jamais bloquant).
 */
function getTransporter(): Transporter | null {
  if (transporterConfigured) return transporter;
  transporterConfigured = true;

  const { host, port, secure, user, password } = config.email;
  if (!host || host === 'localhost' || !user || !password) {
    console.warn('[mail] SMTP non configuré (EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD manquants) — envoi des emails désactivé.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure, // true = TLS implicite (port 465), false = STARTTLS (port 587)
    auth: { user, password },
  });

  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCredentialsEmailHtml(params: {
  firstName: string;
  lastName: string;
  role: AccountRole;
  login: string;
  password: string;
  loginUrl: string;
}): string {
  const { firstName, lastName, role, login, password, loginUrl } = params;
  const copy = ROLE_COPY[role];
  const fullName = escapeHtml(`${firstName} ${lastName}`.trim());
  const schoolName = escapeHtml(config.school.name);

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#F3F4F8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(23,31,63,0.08);">
            <tr>
              <td style="background:${copy.accent};padding:28px 32px;">
                <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:.2px;">HorizonEcole</span>
                <div style="color:rgba(255,255,255,.85);font-size:13px;margin-top:2px;">${schoolName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;color:#171F3F;">Bonjour ${fullName},</p>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3C4257;">${copy.intro}</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${copy.accentSoft};border-radius:10px;margin:0 0 24px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;">Identifiant de connexion</p>
                      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#171F3F;font-family:'Consolas',monospace;">${escapeHtml(login)}</p>
                      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;">Mot de passe provisoire</p>
                      <p style="margin:0;font-size:15px;font-weight:600;color:#171F3F;font-family:'Consolas',monospace;">${escapeHtml(password)}</p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-radius:8px;background:${copy.accent};">
                      <a href="${loginUrl}" style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Se connecter</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6B7280;">
                  Pour votre sécurité, changez ce mot de passe dès votre première connexion (menu du compte → « Changer le mot de passe »).
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6B7280;">
                  Conservez ces informations confidentielles et ne les partagez avec personne.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #EEF0F4;">
                <p style="margin:0;font-size:12px;color:#9AA1B2;">${schoolName}${config.school.address ? ` · ${escapeHtml(config.school.address)}` : ''}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Envoie l'email de bienvenue avec les identifiants de connexion.
 * Best-effort : n'importe quelle erreur (SMTP injoignable, config absente,
 * timeout…) est loggée et absorbée — l'envoi d'email ne doit jamais faire
 * échouer la création du compte qui l'a déclenché.
 *
 * @returns `true` si l'email a été envoyé, `false` sinon (SMTP non configuré,
 * pas de vraie adresse email, ou échec d'envoi).
 */
export async function sendAccountCredentialsEmail(params: {
  to: string;
  firstName: string;
  lastName: string;
  role: AccountRole;
  login: string;
  password: string;
}): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  const loginUrl = `${config.app.frontendUrl.replace(/\/$/, '')}/login`;

  try {
    await transport.sendMail({
      from: `"${config.email.fromName}" <${config.email.user}>`,
      to: params.to,
      subject: 'Vos identifiants de connexion HorizonEcole',
      html: renderCredentialsEmailHtml({ ...params, loginUrl }),
    });
    return true;
  } catch (err) {
    console.warn(`[mail] Échec de l'envoi des identifiants à ${params.to} :`, (err as Error).message);
    return false;
  }
}
