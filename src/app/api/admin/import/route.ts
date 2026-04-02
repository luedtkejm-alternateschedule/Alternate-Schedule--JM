import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { parseCsv } from "@/lib/csv";
import { roleCanAdmin } from "@/lib/schedule";

const Body = z.object({ teachersCsvText: z.string().optional(), studentsCsvText: z.string().optional() });

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth || !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { teachersCsvText, studentsCsvText } = Body.parse(await req.json());
  const sb = supabaseServer();

  if (teachersCsvText) {
    const rows = parseCsv(teachersCsvText) as any[];
    for (const row of rows) {
      const firstName = String(row["first name"] || row.first_name || row.firstName || "").trim();
      const lastName = String(row["last name"] || row.last_name || row.lastName || "").trim();
      const role = String(row.role || "TEACHER").trim().toUpperCase();
      const duty = String(row.duty || "").trim();
      const scheduleNumber = Number(row["schedule #"] || row.schedule_number || row.scheduleNumber || 1);
      if (!firstName || !lastName) continue;
      const email = `${firstName}.${lastName}@demo.local`.toLowerCase();
      const password = role === "TEACHER_ADMIN" ? "teacheradmin12345" : "teacher12345";
      const hash = await bcrypt.hash(password, 10);
      await sb.from("app_users").upsert({
        email, password_hash: hash, role: role === "TEACHER_ADMIN" ? "TEACHER_ADMIN" : "TEACHER",
        first_name: firstName, last_name: lastName, duty: duty || null, schedule_number: scheduleNumber, special_periods: null
      }, { onConflict: "email" });
    }
  }

  if (studentsCsvText) {
    const rows = parseCsv(studentsCsvText) as any[];
    for (const row of rows) {
      const firstName = String(row["first name"] || row.first_name || row.firstName || "").trim();
      const lastName = String(row["last name"] || row.last_name || row.lastName || "").trim();
      const scheduleNumber = Number(row["Schedule #"] || row["schedule #"] || row.schedule_number || row.scheduleNumber || 1);
      const specialPeriods = String(row["Special Periods"] || row.special_periods || row.specialPeriods || "").trim();
      if (!firstName || !lastName) continue;
      const email = `${firstName}.${lastName}@demo.local`.toLowerCase();
      const hash = await bcrypt.hash("student12345", 10);
      await sb.from("app_users").upsert({
        email, password_hash: hash, role: "STUDENT", first_name: firstName, last_name: lastName,
        duty: null, schedule_number: scheduleNumber, special_periods: specialPeriods || null
      }, { onConflict: "email" });
    }
  }
  return NextResponse.json({ ok: true });
}
