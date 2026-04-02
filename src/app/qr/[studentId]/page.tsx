import { supabaseServer } from "@/lib/supabaseServer";
import { currentPeriodNumber, PERIODS, parseSpecialPeriods, studentTemplate } from "@/lib/schedule";

export default async function QRPage({ params }: { params: { studentId: string } }) {
  const sb = supabaseServer();
  const userRes = await sb.from("app_users").select("*").eq("id", params.studentId).single();
  if (userRes.error || !userRes.data || userRes.data.role !== "STUDENT") {
    return <main><h1>Student not found</h1></main>;
  }
  const student: any = userRes.data;
  const template = studentTemplate(Number(student.schedule_number || 1));
  const special = new Set(parseSpecialPeriods(student.special_periods));
  const choicesRes = await sb.from("student_choices").select("*").eq("student_user_id", student.id);
  const choiceMap = new Map(((choicesRes.data || []) as any[]).map((x: any) => [x.period_number, x]));
  const rows = PERIODS.map((period) => {
    const kind = template[period];
    let label = "";
    if (special.has(period)) label = "Locked";
    else if (kind === "STUDENT_WORK") label = "Student Work";
    else if (kind === "LUNCH") label = "Lunch";
    else label = (choiceMap.get(period) as any)?.choice_label || "Not selected";
    return { period, slotType: kind, label };
  });
  const currentPeriod = currentPeriodNumber(new Date());
  const current = currentPeriod ? (rows.find((r) => r.period === currentPeriod)?.label || "No current location found") : "No active period right now";

  return (
    <main>
      <h1>{student.first_name} {student.last_name}</h1>
      <div className="big-location">{current}</div>
      <div className="card">
        <h2>Today's Schedule</h2>
        <table>
          <thead><tr><th>Period</th><th>Type</th><th>Location / Selection</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.period}><td>{row.period}</td><td>{String(row.slotType).replaceAll("_"," ")}</td><td>{row.label}</td></tr>)}
          </tbody>
        </table>
      </div>
    </main>
  );
}
