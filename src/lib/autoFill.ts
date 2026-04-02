import { PERIODS, currentWeekKey, parseSpecialPeriods, studentTemplate } from "@/lib/schedule";

export async function autofillStudent(sb: any, studentUser: any, changedByUserId: string) {
  const weekKey = currentWeekKey();
  const special = new Set(parseSpecialPeriods(studentUser.special_periods));
  const template = studentTemplate(Number(studentUser.schedule_number || 1));

  const existingChoicesRes = await sb.from("student_choices").select("*").eq("student_user_id", studentUser.id);
  const existingByPeriod = new Map(((existingChoicesRes.data || []) as any[]).map((x: any) => [x.period_number, x]));

  const commonAreasRes = await sb.from("common_areas").select("*").eq("is_enabled", true).order("period_number").order("sort_order");
  const sessionsRes = await sb.from("teacher_sessions").select("*, app_users(first_name,last_name)").eq("week_key", weekKey);

  for (const period of PERIODS) {
    if (special.has(period)) continue;
    if (template[period] !== "ENRICHMENT") continue;
    if (existingByPeriod.has(period)) continue;

    const periodCommon = ((commonAreasRes.data || []) as any[]).filter((x) => x.period_number === period);
    let placed = false;

    for (const area of periodCommon) {
      const countRes = await sb.from("student_choices").select("id", { count: "exact", head: true }).eq("period_number", period).eq("choice_type", "COMMON_AREA").eq("choice_ref", String(area.id));
      const count = countRes.count || 0;
      if (count < area.max_students) {
        await sb.from("student_choices").upsert({
          student_user_id: studentUser.id,
          period_number: period,
          choice_type: "COMMON_AREA",
          choice_ref: String(area.id),
          choice_label: area.name,
          changed_by_user_id: changedByUserId
        }, { onConflict: "student_user_id,period_number" });
        placed = true;
        break;
      }
    }

    if (placed) continue;

    const overflowSessions = ((sessionsRes.data || []) as any[]).filter((s) => s.period_number === period && s.overflow === true);
    for (const session of overflowSessions) {
      const countRes = await sb.from("student_choices").select("id", { count: "exact", head: true }).eq("period_number", period).eq("choice_type", "TEACHER_SESSION").eq("choice_ref", String(session.id));
      const count = countRes.count || 0;
      if (count < session.max_students) {
        const teacherName = session.app_users ? `${session.app_users.first_name} ${session.app_users.last_name}` : "Teacher";
        const roomPart = session.room_number ? ` Room ${session.room_number}` : "";
        await sb.from("student_choices").upsert({
          student_user_id: studentUser.id,
          period_number: period,
          choice_type: "TEACHER_SESSION",
          choice_ref: String(session.id),
          choice_label: `${session.title} — ${teacherName}${roomPart}`,
          changed_by_user_id: changedByUserId
        }, { onConflict: "student_user_id,period_number" });
        break;
      }
    }
  }
}
