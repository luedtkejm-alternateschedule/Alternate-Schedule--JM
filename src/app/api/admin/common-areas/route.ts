import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { roleCanAdmin } from "@/lib/schedule";

const Area = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  maxStudents: z.number().int().min(0),
  isEnabled: z.boolean(),
  periodNumber: z.number().int().min(1).max(8),
  sortOrder: z.number().int().min(1).max(99)
});

export async function GET() {
  const auth: any = getAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseServer();
  const { data, error } = await sb.from("common_areas").select("*").order("period_number").order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ areas: data });
}

export async function POST(req: Request) {
  const auth: any = getAuth();
  if (!auth || !roleCanAdmin(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = z.object({ areas: z.array(Area) }).parse(await req.json());
  const sb = supabaseServer();
  const payload = body.areas.map((x) => ({ id:x.id, name:x.name, description:x.description||null, max_students:x.maxStudents, is_enabled:x.isEnabled, period_number:x.periodNumber, sort_order:x.sortOrder }));
  const { error } = await sb.from("common_areas").upsert(payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
