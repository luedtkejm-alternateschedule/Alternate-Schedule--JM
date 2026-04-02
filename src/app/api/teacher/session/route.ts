import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { currentWeekKey, roleCanAdmin, roleCanTeacher } from "@/lib/schedule";

const Body = z.object({
  teacherUserId: z.string().uuid().optional(),
  periodNumber: z.number().int().min(1).max(8),
  sessionType: z.enum(["OFFICE_HOURS","ENRICHMENT"]),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  maxStudents: z.number().int().min(0).max(5000),
  overflow: z.boolean()
});

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth || (!roleCanTeacher(auth.role) && !roleCanAdmin(auth.role))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = Body.parse(await req.json());
  const teacherUserId = body.teacherUserId || auth.userId;
  if (teacherUserId !== auth.userId && !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Only admins can edit another teacher" }, { status: 403 });

  const sb = supabaseServer();
  const settingsRes = await sb.from("system_settings").select("*").limit(1).maybeSingle();
  const teacherLocked = settingsRes.data?.teacher_lock_datetime ? new Date() > new Date(settingsRes.data.teacher_lock_datetime) : false;
  if (!roleCanAdmin(auth.role) && teacherLocked) return NextResponse.json({ error: "Teacher editing is locked" }, { status: 400 });

  const { error } = await sb.from("teacher_sessions").upsert({
    teacher_user_id: teacherUserId, period_number: body.periodNumber, week_key: currentWeekKey(), session_type: body.sessionType,
    title: body.title, description: body.description || null, room_number: body.roomNumber || null, max_students: body.maxStudents, overflow: body.overflow
  }, { onConflict: "teacher_user_id,period_number,week_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
