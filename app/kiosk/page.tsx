import KioskClient from "./ui";

export default function KioskPage() {
  // Intentionally NO AppShell here:
  // - kiosk is a fullscreen operational mode (no sidebar, no navigation clutter)
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <KioskClient />
    </div>
  );
}