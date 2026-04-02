import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { roleCanAdmin } from "@/lib/schedule";

const Body = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["TEACHER","STUDENT","ADMIN","TEACHER_ADMIN"]),
  duty: z.string().optional(),
  scheduleNumber: z.number().int().min(1).max(99),
  specialPeriods: z.string().optional(),
  email: z.string().email().optional()
});

export async function GET() {
  const auth: any = getAuth();
  if (!auth || !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sb = supabaseServer();
  const { data, error } = await sb.from("app_users").select("id,first_name,last_name,role,email,duty,schedule_number,special_periods").order("last_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: data });
}

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth || !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = Body.parse(await req.json());
  const sb = supabaseServer();
  const email = (body.email || `${body.firstName}.${body.lastName}@demo.local`).toLowerCase();
  const defaultPassword = body.role === "STUDENT" ? "student12345" : body.role === "TEACHER" ? "teacher12345" : body.role === "TEACHER_ADMIN" ? "teacheradmin12345" : "admin12345";
  const hash = await bcrypt.hash(defaultPassword, 10);
  const { error } = await sb.from("app_users").upsert({
    email, password_hash: hash, role: body.role, first_name: body.firstName, last_name: body.lastName,
    duty: body.duty || null, schedule_number: body.scheduleNumber, special_periods: body.specialPeriods || null
  }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, email, defaultPassword });
}
