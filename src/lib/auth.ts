import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
const COOKIE_NAME = "sched_token";
export function signToken(payload: any) { return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" }); }
export function getAuth() { const token = cookies().get(COOKIE_NAME)?.value; if (!token) return null; try { return jwt.verify(token, process.env.JWT_SECRET!); } catch { return null; } }
export function setAuthCookie(token: string) { cookies().set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/" }); }
export function clearAuthCookie() { cookies().set(COOKIE_NAME, "", { httpOnly: true, expires: new Date(0), path: "/" }); }
