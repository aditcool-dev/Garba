import Link from "next/link";

export default function Custom404() {
  return (
    <div style={{ textAlign: "center", padding: "50px", color: "#fff", background: "#090b24", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>404 - Page Not Found</h1>
      <p style={{ marginTop: "1rem", color: "#aab0d0" }}>The requested page could not be found.</p>
      <div style={{ marginTop: "2rem" }}>
        <Link href="/" style={{ color: "#ffd166", textDecoration: "underline" }}>
          Return to GarbaMate Home
        </Link>
      </div>
    </div>
  );
}
