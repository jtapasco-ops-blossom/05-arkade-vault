import { Resend } from "resend";

// Cuenta Resend registrada con este correo; en modo sandbox (onboarding@resend.dev
// sin dominio verificado) solo se puede enviar a la dirección propia de la cuenta.
const CONTACT_TO = "jtapascohenao@gmail.com";
const CONTACT_FROM = "onboarding@resend.dev";

// Rate limiting: máx. 5 envíos por ventana de 10 min por IP.
// lazy: Map en memoria — se reinicia con el servidor y no cubre multi-instancia;
// migrar a un store compartido (Redis) si se despliega en varias instancias.
const RATE_LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  if (isRateLimited(ip)) {
    return Response.json(
      { ok: false, error: "Demasiados mensajes. Espera unos minutos." },
      { status: 429 },
    );
  }

  let body: { name?: unknown; email?: unknown; msg?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo inválido." },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const msg = typeof body.msg === "string" ? body.msg.trim() : "";

  if (!name || !email || !msg || !EMAIL_RE.test(email)) {
    return Response.json(
      { ok: false, error: "Completa nombre, correo válido y mensaje." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "Servicio de correo no configurado." },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `Arcade Vault <${CONTACT_FROM}>`,
    to: CONTACT_TO,
    replyTo: email,
    subject: `Nuevo mensaje de ${name} — Arcade Vault`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
  });

  if (error) {
    return Response.json(
      { ok: false, error: "No se pudo enviar el mensaje." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
