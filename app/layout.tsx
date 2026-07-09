import "./globals.css";
import Link from "next/link";
import AdminPanelNavLink from "@/app/components/AdminPanelNavLink";
import EloRequestNotifications from "@/app/components/EloRequestNotifications";
import NavbarAuthControl from "@/app/components/NavbarAuthControl";
import TeamInviteNotifications from "@/app/components/TeamInviteNotifications";
import UserSettingsWidget from "@/app/components/UserSettingsWidget";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hu">
      <body>
        <nav className="navbar">
          <div className="navbar-links">
            <Link href="/">CS2 HUB</Link>
            <Link href="/players">PLAYERS</Link>
            <Link href="/teams">TEAMS</Link>
            <Link href="/matches">MATCHES</Link>
            <Link href="/brackets">BRACKETS</Link>
            <AdminPanelNavLink />
          </div>
          <NavbarAuthControl />
        </nav>

        {children}
        <TeamInviteNotifications />
        <EloRequestNotifications />
        <UserSettingsWidget />
      </body>
    </html>
  );
}