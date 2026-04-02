import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { roleCanAdmin, roleCanTeacher, todayKey } from "@/lib/schedule";

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const targetUserId = body?.targetUserId || auth.userId;
  if (targetUserId !== auth.userId && !roleCanTeacher(auth.role) && !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = supabaseServer();
  const settingsRes = await sb.from("system_settings").select("*").limit(1).maybeSingle();
  const studentLocked = settingsRes.data?.student_lock_datetime ? new Date() > new Date(settingsRes.data.student_lock_datetime) : false;
  if (auth.userId === targetUserId && auth.role === "STUDENT" && studentLocked) return NextResponse.json({ error: "Student saving is locked" }, { status: 400 });

  const { error } = await sb.from("student_schedule_status").upsert({
    student_user_id: targetUserId, schedule_date: todayKey(), is_saved: true, saved_at: new Date().toISOString()
  }, { onConflict: "student_user_id,schedule_date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth: any = getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const targetUserId = body?.targetUserId || auth.userId;
  if (targetUserId !== auth.userId && !roleCanTeacher(auth.role) && !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = supabaseServer();
  const settingsRes = await sb.from("system_settings").select("*").limit(1).maybeSingle();
  const studentLocked = settingsRes.data?.student_lock_datetime ? new Date() > new Date(settingsRes.data.student_lock_datetime) : false;
  if (auth.userId === targetUserId && auth.role === "STUDENT" && studentLocked) return NextResponse.json({ error: "Student editing is locked" }, { status: 400 });

  const { error } = await sb.from("student_schedule_status").upsert({
    student_user_id: targetUserId, schedule_date: todayKey(), is_saved: false, saved_at: null
  }, { onConflict: "student_user_id,schedule_date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
