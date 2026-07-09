import Link from "next/link";

export default function Sidebar() {
  const links = [
    { name: "Home", href: "/" },
    { name: "Matches", href: "/matches" },
    { name: "Teams", href: "/teams" },
    { name: "Players", href: "/players" },
    { name: "Rankings", href: "/rankings" },
    { name: "Events", href: "/events" },
    { name: "Stats", href: "/stats" },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-[#111217] p-6 animate-fade-in">
      <h1 className="mb-8 text-3xl font-bold text-orange-500 neon-title">
        PulseESP
      </h1>

      <nav className="space-y-2">
        {links.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-lg px-4 py-3 transition hover:bg-zinc-800 sidebar-link"
            style={{
              animation: `slide-up 0.5s ease-out backwards`,
              animationDelay: `${index * 0.08}s`,
            }}
          >
            {link.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}