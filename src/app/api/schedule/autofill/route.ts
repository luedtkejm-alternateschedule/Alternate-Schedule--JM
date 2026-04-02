import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { autofillStudent } from "@/lib/autoFill";
import { roleCanAdmin, roleCanTeacher } from "@/lib/schedule";

const Body = z.object({ targetUserId: z.string().uuid().optional() });

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { targetUserId } = Body.parse(await req.json());
  const actualTargetId = targetUserId || auth.userId;
  if (actualTargetId !== auth.userId && !roleCanTeacher(auth.role) && !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = supabaseServer();
  const userRes = await sb.from("app_users").select("*").eq("id", actualTargetId).single();
  if (userRes.error || !userRes.data) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (userRes.data.role !== "STUDENT") return NextResponse.json({ error: "Auto-fill only applies to students" }, { status: 400 });

  await autofillStudent(sb, userRes.data, auth.userId);
  return NextResponse.json({ ok: true });
}
