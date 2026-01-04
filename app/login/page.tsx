import LoginClient from "./ui";

export default function LoginPage() {
  return (
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Login</h1>
      <p style={{ marginTop: 8, color: "#666" }}>
        Dev login. Başarılı olunca /admin/company sayfasına yönlendirir.
      </p>

      <div style={{ marginTop: 16 }}>
        <LoginClient />
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
        Varsayılan: <code>admin@local</code> / <code>Admin123!</code>
      </div>
    </main>
  );
}
