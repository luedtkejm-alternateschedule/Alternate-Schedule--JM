import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERIODS, currentWeekKey, parseSpecialPeriods, roleCanAdmin, roleCanTeacher, studentTemplate, teacherTemplate, todayKey } from "@/lib/schedule";

export async function GET(req: Request) {
  const auth: any = getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const currentUserRes = await sb.from("app_users").select("*").eq("id", auth.userId).single();
  if (currentUserRes.error || !currentUserRes.data) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("targetUserId");
  let effectiveUser: any = currentUserRes.data;

  if (targetUserId) {
    const targetRes = await sb.from("app_users").select("*").eq("id", targetUserId).single();
    if (!targetRes.error && targetRes.data) {
      if (roleCanAdmin(auth.role)) effectiveUser = targetRes.data;
      else if (roleCanTeacher(auth.role) && targetRes.data.role === "STUDENT") effectiveUser = targetRes.data;
    }
  }

  const usersRes = await sb.from("app_users").select("id,first_name,last_name,role,schedule_number").order("last_name");
  const areasRes = await sb.from("common_areas").select("*").eq("is_enabled", true).order("period_number").order("sort_order");
  const sessionsRes = await sb.from("teacher_sessions").select("*, app_users(first_name,last_name)").eq("week_key", currentWeekKey());
  const settingsRes = await sb.from("system_settings").select("*").limit(1).maybeSingle();
  const statusRes = effectiveUser.role === "STUDENT"
    ? await sb.from("student_schedule_status").select("*").eq("student_user_id", effectiveUser.id).eq("schedule_date", todayKey()).maybeSingle()
    : { data: null };

  const rows: any[] = [];
  if (effectiveUser.role === "STUDENT") {
    const template = studentTemplate(Number(effectiveUser.schedule_number || 1));
    const special = new Set(parseSpecialPeriods(effectiveUser.special_periods));
    const choicesRes = await sb.from("student_choices").select("*").eq("student_user_id", effectiveUser.id);
    const choiceMap = new Map(((choicesRes.data || []) as any[]).map((x: any) => [x.period_number, x]));

    for (const period of PERIODS) {
      const kind = template[period];
      const locked = special.has(period);
      const choice: any = choiceMap.get(period);
      let label = "";
      let editable = false;
      let options: any[] = [];

      if (locked) label = "Locked";
      else if (kind === "STUDENT_WORK") label = "Student Work";
      else if (kind === "LUNCH") label = "Lunch";
      else {
        editable = (auth.userId === effectiveUser.id && auth.role === "STUDENT") || roleCanTeacher(auth.role) || roleCanAdmin(auth.role);
        label = choice?.choice_label || "";
        const areaOptions = ((areasRes.data || []) as any[]).filter((x) => x.period_number === period).map((x) => ({ value: `COMMON_AREA:${x.id}`, label: `${x.name} (${x.max_students})` }));
        const sessionOptions = ((sessionsRes.data || []) as any[])
  .filter((s) => s.period_number === period)
  .map((s: any) => {
    const teacherLastName = s.app_users?.last_name || "Teacher";
    const roomPart = s.room_number ? ` Room ${s.room_number}` : "";

    const label =
      s.session_type === "OFFICE_HOURS"
        ? `${teacherLastName} - Office Hours${roomPart}`
        : `${s.title} — ${teacherLastName}${roomPart}`;

    return {
      value: `TEACHER_SESSION:${s.id}`,
      label
    };
  });
        options = [...areaOptions, ...sessionOptions];
      }

      rows.push({ period, slotType: kind, locked, label, editable, selectedValue: choice ? `${choice.choice_type}:${choice.choice_ref}` : "", options });
    }
  } else {
    const template = teacherTemplate(Number(effectiveUser.schedule_number || 1));
    const sessions = ((sessionsRes.data || []) as any[]).filter((x) => x.teacher_user_id === effectiveUser.id);
    const sessionMap = new Map(sessions.map((x: any) => [x.period_number, x]));
    for (const period of PERIODS) {
      const slotType = template[period];
      const session: any = sessionMap.get(period);
      rows.push({
        period, slotType, locked: false,
        label: slotType === "ENRICHMENT" || slotType === "OFFICE_HOURS" ? (session?.title || (slotType === "ENRICHMENT" ? "Enrichment" : "Office Hours")) :
          slotType === "STUDENT_WORK" ? "Student Work" : slotType === "LUNCH" ? "Lunch" : slotType === "PREP" ? "Prep" : "Duty",
        sessionDetails: slotType === "ENRICHMENT" || slotType === "OFFICE_HOURS" ? {
          title: session?.title || "", description: session?.description || "", roomNumber: session?.room_number || "", maxStudents: session?.max_students || 0, overflow: !!session?.overflow
        } : null
      });
    }
  }

  return NextResponse.json({
    me: currentUserRes.data,
    targetUser: effectiveUser,
    users: usersRes.data || [],
    commonAreas: areasRes.data || [],
    rows,
    settings: settingsRes.data || null,
    scheduleStatus: statusRes.data || { is_saved: false }
  });
}
