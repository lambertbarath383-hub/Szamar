import { NextResponse } from "next/server";
import { type EloChangeRequest } from "@/app/lib/elo-requests";
import { readEloRequestsFromFile, writeEloRequestsToFile } from "@/app/lib/server/elo-requests-store";

export async function GET() {
  const requests = await readEloRequestsFromFile();
  return NextResponse.json({ ok: true, data: requests });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<EloChangeRequest>;
  const userId = typeof body.userId === "string" ? body.userId : null;
  const requestedElo = typeof body.requestedElo === "number" ? body.requestedElo : null;
  if (!userId || requestedElo === null) {
    return NextResponse.json({ ok: false, message: "Hiányos ELO kérelem adat." }, { status: 400 });
  }
  if (!Number.isInteger(requestedElo) || requestedElo < 0 || requestedElo > 9999) {
    return NextResponse.json({ ok: false, message: "Az ELO kérés 0 és 9999 közötti egész szám lehet." }, { status: 400 });
  }

  const requests = await readEloRequestsFromFile();
  const pending = requests.find((item) => item.userId === userId && item.status === "pending");
  if (pending) {
    return NextResponse.json({ ok: false, message: "Már van függő ELO kérelmed." }, { status: 409 });
  }

  const nextRequest: EloChangeRequest = {
    id: body.id && typeof body.id === "string" ? body.id : `elo_req_${Date.now()}`,
    userId,
    requestedElo,
    status: "pending",
    createdAt: body.createdAt && typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString(),
  };
  const nextRequests = [nextRequest, ...requests];
  await writeEloRequestsToFile(nextRequests);
  return NextResponse.json({ ok: true, request: nextRequest });
}
