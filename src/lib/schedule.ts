export const PERIODS = [1,2,3,4,5,6,7,8];
export function currentWeekKey() {
  const date = new Date();
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - firstJan.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + firstJan.getDay()) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
export function parseSpecialPeriods(value: string | null | undefined) {
  if (!value) return [];
  return value.split(/[ ,;]+/).map((x) => Number(x.trim())).filter((x) => Number.isInteger(x) && x >= 1 && x <= 8);
}
export function teacherTemplate(scheduleNumber?: number) {
  return { 1:"ENRICHMENT",2:"OFFICE_HOURS",3:"STUDENT_WORK",4:"ENRICHMENT",5:"DUTY",6:"LUNCH",7:"OFFICE_HOURS",8:"PREP" } as Record<number,string>;
}
export function studentTemplate(scheduleNumber?: number) {
  return { 1:"STUDENT_WORK",2:"STUDENT_WORK",3:"ENRICHMENT",4:"LUNCH",5:"ENRICHMENT",6:"ENRICHMENT",7:"ENRICHMENT",8:"ENRICHMENT" } as Record<number,string>;
}
export function roleCanAdmin(role?: string) { return role === "ADMIN" || role === "TEACHER_ADMIN"; }
export function roleCanTeacher(role?: string) { return role === "TEACHER" || role === "TEACHER_ADMIN"; }
export function currentPeriodNumber(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const ranges = [
    { p:1, start:480, end:529 },{ p:2, start:530, end:579 },{ p:3, start:580, end:629 },{ p:4, start:630, end:679 },
    { p:5, start:680, end:729 },{ p:6, start:730, end:779 },{ p:7, start:780, end:829 },{ p:8, start:830, end:879 }
  ];
  const found = ranges.find((r) => minutes >= r.start && minutes <= r.end);
  return found ? found.p : null;
}
