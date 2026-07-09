import { NextResponse } from "next/server";

type LoginRequest = {
  name?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginRequest;
  const password = body.password?.trim() ?? "";

  const moderatorPassword =
    process.env.MODERATOR_PASSWORD ?? process.env.APP_ADMIN_KEY ?? "12345";

  if (!password || password !== moderatorPassword) {
    return NextResponse.json(
      { ok: false, message: "Hibás jelszó." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Sikeres moderátor bejelentkezés.",
  });
}
