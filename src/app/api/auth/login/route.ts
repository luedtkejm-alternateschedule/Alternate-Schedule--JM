import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { setAuthCookie, signToken } from "@/lib/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const sb = supabaseServer();
  const { data, error } = await sb.from("app_users").select("*").eq("email", body.email.toLowerCase()).single();
  if (error || !data) return NextResponse.json({ error: "Invalid login" }, { status: 401 });
  const ok = await bcrypt.compare(body.password, data.password_hash);
  if (!ok) return NextResponse.json({ error: "Invalid login" }, { status: 401 });
  const token = signToken({ userId: data.id, role: data.role, email: data.email, firstName: data.first_name, lastName: data.last_name });
  setAuthCookie(token);
  return NextResponse.json({ ok: true });
}
