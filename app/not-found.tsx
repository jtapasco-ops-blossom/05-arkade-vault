import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker neon-magenta">ERROR 404</h1>
        <div className="sub">
          FICHA NO ENCONTRADA EN LA MÁQUINA <span className="blink">_</span>
        </div>
      </section>
      <div style={{ textAlign: "center", padding: "0 16px 80px" }}>
        <div className="pixel" style={{ fontSize: 14, color: "var(--ink-faint)", marginBottom: 24 }}>
          ESTE JUEGO SE QUEDÓ SIN CRÉDITOS
        </div>
        <Link href="/" className="btn xl pulse">
          ▶ VOLVER AL VAULT
        </Link>
      </div>
    </div>
  );
}
