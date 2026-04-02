import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { roleCanAdmin } from "@/lib/schedule";

export async function GET() {
  const auth: any = getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseServer();
  const { data, error } = await sb.from("system_settings").select("*").limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ settings: data });
}

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth || !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = z.object({ studentLockDatetime: z.string().nullable().optional(), teacherLockDatetime: z.string().nullable().optional() }).parse(await req.json());
  const sb = supabaseServer();
  const existing = await sb.from("system_settings").select("id").limit(1).maybeSingle();
  const payload = { student_lock_datetime: body.studentLockDatetime || null, teacher_lock_datetime: body.teacherLockDatetime || null };
  const result = existing.data?.id ? await sb.from("system_settings").update(payload).eq("id", existing.data.id) : await sb.from("system_settings").insert(payload);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
