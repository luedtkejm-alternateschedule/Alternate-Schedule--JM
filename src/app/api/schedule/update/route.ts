import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { parseSpecialPeriods, roleCanAdmin, roleCanTeacher, studentTemplate, teacherTemplate, currentWeekKey } from "@/lib/schedule";

const Change = z.object({ targetUserId: z.string().uuid(), periodNumber: z.number().int().min(1).max(8), choiceType: z.enum(["COMMON_AREA","TEACHER_SESSION"]), choiceRef: z.string().min(1) });
const Body = z.object({ changes: z.array(Change) });

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = Body.parse(await req.json());
  const sb = supabaseServer();
  const settingsRes = await sb.from("system_settings").select("*").limit(1).maybeSingle();
  const studentLocked = settingsRes.data?.student_lock_datetime ? new Date() > new Date(settingsRes.data.student_lock_datetime) : false;

  for (const change of body.changes) {
    const userRes = await sb.from("app_users").select("*").eq("id", change.targetUserId).single();
    if (userRes.error || !userRes.data) return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    const target: any = userRes.data;

    if (target.role === "STUDENT") {
      const selfStudent = auth.userId === target.id && auth.role === "STUDENT";
      const canEdit = selfStudent || roleCanTeacher(auth.role) || roleCanAdmin(auth.role);
      if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (selfStudent && studentLocked) return NextResponse.json({ error: "Student editing is locked" }, { status: 400 });

      const locked = new Set(parseSpecialPeriods(target.special_periods));
      if (locked.has(change.periodNumber)) return NextResponse.json({ error: `Period ${change.periodNumber} is locked` }, { status: 400 });
      const template = studentTemplate(Number(target.schedule_number || 1));
      if (template[change.periodNumber] !== "ENRICHMENT") return NextResponse.json({ error: "Only enrichment periods can be changed for students" }, { status: 400 });

      if (change.choiceType === "COMMON_AREA") {
        const areaRes = await sb.from("common_areas").select("*").eq("id", change.choiceRef).single();
        if (areaRes.error || !areaRes.data) return NextResponse.json({ error: "Common area not found" }, { status: 404 });
        const area: any = areaRes.data;
        if (area.period_number !== change.periodNumber || !area.is_enabled) return NextResponse.json({ error: "That common area is not available in this period" }, { status: 400 });
        const countRes = await sb.from("student_choices").select("id", { count: "exact", head: true }).eq("period_number", change.periodNumber).eq("choice_type", "COMMON_AREA").eq("choice_ref", change.choiceRef);
        const currentChoiceRes = await sb.from("student_choices").select("*").eq("student_user_id", target.id).eq("period_number", change.periodNumber).maybeSingle();
        const same = currentChoiceRes.data?.choice_type === "COMMON_AREA" && currentChoiceRes.data?.choice_ref === change.choiceRef;
        const count = countRes.count || 0;
        if (!same && count >= area.max_students) return NextResponse.json({ error: "Maximum reached for this common area" }, { status: 400 });
        await sb.from("student_choices").upsert({ student_user_id: target.id, period_number: change.periodNumber, choice_type: "COMMON_AREA", choice_ref: change.choiceRef, choice_label: area.name, changed_by_user_id: auth.userId }, { onConflict: "student_user_id,period_number" });
      }

      if (change.choiceType === "TEACHER_SESSION") {
        const sessionRes = await sb.from("teacher_sessions").select("*, app_users(first_name,last_name)").eq("id", change.choiceRef).eq("week_key", currentWeekKey()).single();
        if (sessionRes.error || !sessionRes.data) return NextResponse.json({ error: "Teacher session not found" }, { status: 404 });
        const session: any = sessionRes.data;
        if (session.period_number !== change.periodNumber) return NextResponse.json({ error: "That teacher session is not in this period" }, { status: 400 });
        const countRes = await sb.from("student_choices").select("id", { count: "exact", head: true }).eq("period_number", change.periodNumber).eq("choice_type", "TEACHER_SESSION").eq("choice_ref", change.choiceRef);
        const currentChoiceRes = await sb.from("student_choices").select("*").eq("student_user_id", target.id).eq("period_number", change.periodNumber).maybeSingle();
        const same = currentChoiceRes.data?.choice_type === "TEACHER_SESSION" && currentChoiceRes.data?.choice_ref === change.choiceRef;
        const count = countRes.count || 0;
        if (!same && count >= session.max_students) return NextResponse.json({ error: "Maximum reached for this teacher session" }, { status: 400 });
        const teacherName = session.app_users ? `${session.app_users.first_name} ${session.app_users.last_name}` : "Teacher";
        const roomPart = session.room_number ? ` Room ${session.room_number}` : "";
        await sb.from("student_choices").upsert({ student_user_id: target.id, period_number: change.periodNumber, choice_type: "TEACHER_SESSION", choice_ref: change.choiceRef, choice_label: `${session.title} — ${teacherName}${roomPart}`, changed_by_user_id: auth.userId }, { onConflict: "student_user_id,period_number" });
      }
    } else {
      if (!roleCanAdmin(auth.role)) return NextResponse.json({ error: "Only administrators can change a teacher table" }, { status: 403 });
      const template = teacherTemplate(Number(target.schedule_number || 1));
      const slotType = template[change.periodNumber];
      if (slotType !== "ENRICHMENT" && slotType !== "OFFICE_HOURS") return NextResponse.json({ error: "Only teacher enrichment and office hours entries can be edited" }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}
