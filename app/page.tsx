import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1 className="title">CS2 HUB</h1>

      <div className="grid">
        <Link href="/players" className="panel">
          <h2>JÁTÉKOSOK</h2>
          <p>Világranglista</p>
        </Link>

        <Link href="/teams" className="panel">
          <h2>CSAPATOK</h2>
          <p>Csapat ranglista</p>
        </Link>

        <Link href="/matches" className="panel">
          <h2>MATCHES</h2>
          <p>Közelgő mérkőzések</p>
        </Link>

        <Link href="/brackets" className="panel">
          <h2>BRACKETS</h2>
          <p>Tornák és versenyágak</p>
        </Link>
      </div>
    </main>
  );
}