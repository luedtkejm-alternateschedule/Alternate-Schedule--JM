import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { roleCanTeacher } from "@/lib/schedule";

export async function GET() {
  const auth: any = getAuth();
  if (!auth || !roleCanTeacher(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sb = supabaseServer();
  const { data, error } = await sb.from("teacher_sessions").select("title, description, room_number, period_number, week_key, updated_at").eq("teacher_user_id", auth.userId).eq("session_type", "ENRICHMENT").order("updated_at", { ascending: false }).limit(4);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sessions: data });
}
