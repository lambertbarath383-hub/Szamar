import { NextResponse } from "next/server";
import { readEloRequestsFromFile, writeEloRequestsToFile } from "@/app/lib/server/elo-requests-store";
import { readSiteUsersFromFile } from "@/app/lib/server/site-users-store";
import { logAction } from "@/app/lib/server/log-action";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: "pending" | "approved" | "rejected";
    resolvedAt?: string;
    reviewedBy?: string;
    userSeenAt?: string;
  };

  const requests = await readEloRequestsFromFile();
  const index = requests.findIndex((item) => item.id === id);
  if (index === -1) {
    return NextResponse.json({ ok: false, message: "ELO kérelem nem található." }, { status: 404 });
  }

  const current = requests[index];
  const updated = {
    ...current,
    ...(body.status ? { status: body.status } : {}),
    ...(typeof body.resolvedAt === "string" ? { resolvedAt: body.resolvedAt } : {}),
    ...(typeof body.reviewedBy === "string" ? { reviewedBy: body.reviewedBy } : {}),
    ...(typeof body.userSeenAt === "string" ? { userSeenAt: body.userSeenAt } : {}),
  };

  const nextRequests = [...requests];
  nextRequests[index] = updated;
  await writeEloRequestsToFile(nextRequests);

  if (body.status === "approved" || body.status === "rejected") {
    const users = await readSiteUsersFromFile();
    const user = users.find((u) => u.id === current.userId);
    const userName = user?.name ?? "ismeretlen játékos";
    const by = typeof body.reviewedBy === "string" ? body.reviewedBy : "Moderátor";
    const statusText = body.status === "approved" ? "✅ jóváhagyta" : "❌ elutasította";
    await logAction(`${by} ${statusText} ${userName} ELO kérelmét (${current.requestedElo} ELO)`);
  }

  return NextResponse.json({ ok: true, request: updated });
}
