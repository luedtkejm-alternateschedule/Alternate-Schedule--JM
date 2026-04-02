import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
export async function GET() { return NextResponse.json({ user: getAuth() }); }
