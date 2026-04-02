"use client";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

function fullName(user: any) {
  if (!user) return "";
  return `${user.first_name} ${user.last_name}`.trim();
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [staged, setStaged] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [teachersCsv, setTeachersCsv] = useState("first name,last name,role,duty,schedule #\nTaylor,Teacher,TEACHER,Hall Duty,1");
  const [studentsCsv, setStudentsCsv] = useState("first name,last name,Schedule #,Special Periods\nSam,Student,1,");
  const [manual, setManual] = useState<any>({ firstName:"", lastName:"", role:"STUDENT", duty:"", scheduleNumber:1, specialPeriods:"", email:"" });
  const [areaDrafts, setAreaDrafts] = useState<any[]>([]);
  const [teacherForms, setTeacherForms] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);
  const [settingsForm, setSettingsForm] = useState<any>({ studentLockDatetime:"", teacherLockDatetime:"" });

  const me = data?.me;
  const targetUser = data?.targetUser;
  const canAdmin = me && (me.role === "ADMIN" || me.role === "TEACHER_ADMIN");
  const canTeacher = me && (me.role === "TEACHER" || me.role === "TEACHER_ADMIN");
  const studentsOnly = (data?.users || []).filter((u: any) => u.role === "STUDENT");
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function load(useTarget?: string) {
    const q = useTarget || targetUserId ? `?targetUserId=${encodeURIComponent(useTarget || targetUserId)}` : "";
    const res = await fetch(`/api/dashboard${q}`);
    const json = await res.json();
    setData(json);
    setAreaDrafts((json.commonAreas || []).map((x: any) => ({ ...x, maxStudents:x.max_students, isEnabled:x.is_enabled, periodNumber:x.period_number, sortOrder:x.sort_order })));
    setSettingsForm({
      studentLockDatetime: json.settings?.student_lock_datetime || "",
      teacherLockDatetime: json.settings?.teacher_lock_datetime || ""
    });
    const tf: any = {};
    (json.rows || []).forEach((row: any) => {
      if (row.sessionDetails) tf[row.period] = { ...row.sessionDetails };
    });
    setTeacherForms(tf);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (me && canTeacher) {
      fetch("/api/teacher/history").then(r=>r.json()).then(j=>setHistory(j.sessions || [])).catch(()=>{});
    }
  }, [me, canTeacher]);

  async function logout() {
    await fetch("/api/auth/logout", { method:"POST" });
    window.location.href = "/";
  }

  async function importCsv() {
    setMessage("");
    const res = await fetch("/api/admin/import", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ teachersCsvText:teachersCsv, studentsCsvText:studentsCsv }) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Import failed");
    setMessage("Import complete.");
    await load();
  }

  async function addManualUser() {
    setMessage("");
    const res = await fetch("/api/admin/users", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(manual) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not create user");
    setMessage(`Created ${json.email}. Password: ${json.defaultPassword}`);
    setManual({ firstName:"", lastName:"", role:"STUDENT", duty:"", scheduleNumber:1, specialPeriods:"", email:"" });
    await load();
  }

  function stageChange(period: number, value: string) {
    const [choiceType, choiceRef] = value.split(":");
    if (!choiceType || !choiceRef) return;
    const next = [...staged.filter((x) => x.periodNumber !== period), { targetUserId: targetUser.id, periodNumber:period, choiceType, choiceRef }];
    setStaged(next);
    setData((prev: any) => ({ ...prev, rows: (prev.rows || []).map((r: any) => r.period === period ? { ...r, selectedValue:value } : r) }));
  }

  function undoLast() {
    if (!staged.length) return;
    setStaged(staged.slice(0, -1));
    load(targetUser?.id);
  }

  async function saveStaged() {
    if (!staged.length) return setMessage("No staged changes to save.");
    const res = await fetch("/api/schedule/update", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ changes: staged }) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Save failed");
    setMessage("Changes saved.");
    setStaged([]);
    await load(targetUser.id);
  }

  async function saveStudentSchedule() {
    const res = await fetch("/api/schedule/save", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ targetUserId: targetUser.id }) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not save schedule");
    setMessage("Student schedule saved.");
    await load(targetUser.id);
  }

  async function unlockStudentSchedule() {
    const res = await fetch("/api/schedule/save", { method:"DELETE", headers:{ "content-type":"application/json" }, body: JSON.stringify({ targetUserId: targetUser.id }) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not re-open schedule");
    setMessage("Schedule reopened for editing.");
    await load(targetUser.id);
  }

  async function autoFill() {
    const res = await fetch("/api/schedule/autofill", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ targetUserId: targetUser.id }) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Auto-fill failed");
    setMessage("Missing student enrichment periods auto-filled.");
    await load(targetUser.id);
  }

  async function saveCommonAreas() {
    const payload = areaDrafts.map((x) => ({ id:x.id, name:x.name, description:x.description, maxStudents:Number(x.maxStudents), isEnabled:!!x.isEnabled, periodNumber:Number(x.periodNumber), sortOrder:Number(x.sortOrder) }));
    const res = await fetch("/api/admin/common-areas", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ areas: payload }) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not save common areas");
    setMessage("Common areas saved.");
    await load();
  }

  async function saveSettings() {
    const res = await fetch("/api/admin/settings", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(settingsForm) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not save lock settings");
    setMessage("Lock date/times saved.");
    await load(targetUser?.id);
  }

  async function saveTeacherSession(period: number, slotType: string) {
    const form = teacherForms[period];
    const res = await fetch("/api/teacher/session", { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ teacherUserId: targetUser.id, periodNumber: period, sessionType: slotType, title: form.title, description: form.description, roomNumber: form.roomNumber, maxStudents: Number(form.maxStudents), overflow: !!form.overflow }) });
    const json = await res.json();
    if (!res.ok) return setMessage(json.error || "Could not save teacher session");
    setMessage("Teacher session saved.");
    await load(targetUser.id);
  }

  const selectedUserOptions = useMemo(() => {
    if (!data?.users) return [];
    if (canAdmin) return data.users;
    if (canTeacher) return [me, ...studentsOnly];
    return [me];
  }, [data, me, canAdmin, canTeacher, studentsOnly]);

  if (!data) return <main><p>Loading…</p></main>;

  const studentSaved = !!data?.scheduleStatus?.is_saved;
  const selfStudent = me?.role === "STUDENT" && targetUser?.id === me?.id;
  const teacherViewingStudent = canTeacher && targetUser?.role === "STUDENT";
  const adminEditing = canAdmin && editMode;
  const qrUrl = targetUser?.role === "STUDENT" ? `${siteUrl}/qr/${targetUser.id}` : "";

  return (
    <main>
      <h1>Dashboard</h1>
      <div className={`card ${editMode ? "edit-mode" : ""}`}>
        <div className="row">
          <div className="col">
            <div className="badge">{me.role}</div>
            <div>{fullName(me)} ({me.email})</div>
          </div>
          <div className="col">
            <label>View schedule for</label>
            <select value={targetUser?.id || ""} onChange={async (e) => { setTargetUserId(e.target.value); setEditMode(false); setStaged([]); await load(e.target.value); }}>
              {selectedUserOptions.map((u: any) => <option key={u.id} value={u.id}>{fullName(u)} — {u.role}</option>)}
            </select>
          </div>
          <div className="col"><button onClick={logout}>Log out</button></div>
        </div>
        {canAdmin ? <>
          <div className="banner">Administrators must enter edit mode before manual changes and additions.</div>
          <div className="row">
            <div className="col"><button className={editMode ? "warn" : "secondary"} onClick={() => setEditMode(!editMode)}>{editMode ? "Exit Edit Mode" : "Enter Edit Mode"}</button></div>
            <div className="col"><button disabled={!editMode || staged.length === 0} onClick={undoLast}>Back / Undo Most Recent Change</button></div>
            <div className="col"><button className="primary" disabled={!editMode} onClick={saveStaged}>Save Staged Schedule Changes</button></div>
          </div>
        </> : null}
        {message ? <p>{message}</p> : null}
      </div>

      {targetUser?.role === "STUDENT" ? (
        <div className="card">
          <h2>{fullName(targetUser)} — Student schedule</h2>
          <div className="row">
            <div className="col" style={{maxWidth:260}}>{qrUrl ? <QRCodeSVG value={qrUrl} size={220} /> : null}</div>
            <div className="col"><p><small>{qrUrl}</small></p></div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2>{fullName(targetUser)} — Periods 1–8</h2>
        {targetUser?.role === "STUDENT" && studentSaved ? (
          <div className="row">
            <div className="col"><span className="badge">Saved schedule</span></div>
            {selfStudent ? <div className="col"><button className="secondary" onClick={unlockStudentSchedule}>Edit schedule</button></div> : null}
          </div>
        ) : null}

        <table>
          <thead><tr><th>Period</th><th>Slot</th><th>Current</th><th>Action</th></tr></thead>
          <tbody>
            {(data.rows || []).map((row: any) => {
              const canChangeNow = row.editable && ((selfStudent && !studentSaved) || teacherViewingStudent || adminEditing);
              return (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{String(row.slotType).replaceAll("_", " ")}</td>
                  <td>{row.locked ? <span className="locked">Locked</span> : null} {!row.locked && !row.label && row.slotType === "ENRICHMENT" ? <span className="fixed">Not selected</span> : row.label}</td>
                  <td>
                    {canChangeNow && row.options?.length ? (
                      <select value={row.selectedValue || ""} onChange={(e) => stageChange(row.period, e.target.value)}>
                        <option value="">Select…</option>
                        {row.options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    ) : row.locked ? <small>Special period lock</small> : <small>No change available</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {targetUser?.role === "STUDENT" && !studentSaved ? (
          <div className="row" style={{ marginTop: 12 }}>
            <div className="col"><button onClick={autoFill}>Auto-fill remaining</button></div>
            <div className="col"><button className="primary" onClick={saveStudentSchedule}>Save schedule</button></div>
            {(teacherViewingStudent || adminEditing) && staged.length ? <div className="col"><button className="primary" onClick={saveStaged}>Save overrides</button></div> : null}
          </div>
        ) : null}

        {(teacherViewingStudent || adminEditing) && staged.length && !(targetUser?.role === "STUDENT" && !studentSaved) ? (
          <div style={{ marginTop: 12 }}><button className="primary" onClick={saveStaged}>Save overrides</button></div>
        ) : null}
      </div>

      {(targetUser?.role === "TEACHER" || targetUser?.role === "TEACHER_ADMIN") ? (
        <div className="card">
          <h2>Teacher weekly Office Hours / Enrichment setup</h2>
          {(data.rows || []).filter((row: any) => row.sessionDetails).map((row: any) => (
            <div key={row.period} className="card" style={{ margin: "12px 0" }}>
              <h3>Period {row.period} — {String(row.slotType).replaceAll("_", " ")}</h3>
              <div className="row">
                <div className="col"><label>Title</label><input value={teacherForms[row.period]?.title || ""} onChange={(e)=>setTeacherForms((prev:any)=>({ ...prev, [row.period]: { ...prev[row.period], title:e.target.value } }))} /></div>
                <div className="col"><label>Room number</label><input value={teacherForms[row.period]?.roomNumber || ""} onChange={(e)=>setTeacherForms((prev:any)=>({ ...prev, [row.period]: { ...prev[row.period], roomNumber:e.target.value } }))} /></div>
                <div className="col"><label>Maximum number</label><input type="number" value={teacherForms[row.period]?.maxStudents || 0} onChange={(e)=>setTeacherForms((prev:any)=>({ ...prev, [row.period]: { ...prev[row.period], maxStudents:Number(e.target.value) } }))} /></div>
              </div>
              <div className="stacked">
                <div><label>Description</label><textarea rows={3} value={teacherForms[row.period]?.description || ""} onChange={(e)=>setTeacherForms((prev:any)=>({ ...prev, [row.period]: { ...prev[row.period], description:e.target.value } }))} /></div>
                <label style={{display:"flex",gap:8,alignItems:"center"}}><input style={{width:16}} type="checkbox" checked={!!teacherForms[row.period]?.overflow} onChange={(e)=>setTeacherForms((prev:any)=>({ ...prev, [row.period]: { ...prev[row.period], overflow:e.target.checked } }))} />Overflow</label>
                <button className="primary" onClick={() => saveTeacherSession(row.period, row.slotType)}>Save period {row.period}</button>
                {row.slotType === "ENRICHMENT" && history.length ? (
                  <div>
                    <p><small>Auto-fill from the last four enrichments entered:</small></p>
                    <div className="row">
                      {history.map((item:any, idx:number) => (
                        <div className="col" key={idx}>
                          <button onClick={() => setTeacherForms((prev:any)=>({ ...prev, [row.period]: { ...prev[row.period], title:item.title, description:item.description || "", roomNumber:item.room_number || "" } }))}>{item.title}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {canAdmin ? (
        <div className={`card ${editMode ? "edit-mode" : ""}`}>
          <h2>Administrator tools</h2>
          <div className="card">
            <h3>Lock date/times</h3>
            <div className="row">
              <div className="col"><label>Student lock date/time</label><input type="datetime-local" value={settingsForm.studentLockDatetime ? settingsForm.studentLockDatetime.slice(0,16) : ""} onChange={(e)=>setSettingsForm((prev:any)=>({ ...prev, studentLockDatetime:e.target.value }))} /></div>
              <div className="col"><label>Teacher lock date/time</label><input type="datetime-local" value={settingsForm.teacherLockDatetime ? settingsForm.teacherLockDatetime.slice(0,16) : ""} onChange={(e)=>setSettingsForm((prev:any)=>({ ...prev, teacherLockDatetime:e.target.value }))} /></div>
            </div>
            <button className="primary" disabled={!editMode} onClick={saveSettings}>Save lock settings</button>
          </div>

          <div className="card">
            <h3>Import from Google Sheets CSV</h3>
            <div className="row">
              <div className="col"><label>Teachers CSV</label><textarea rows={8} value={teachersCsv} onChange={(e)=>setTeachersCsv(e.target.value)} /></div>
              <div className="col"><label>Students CSV</label><textarea rows={8} value={studentsCsv} onChange={(e)=>setStudentsCsv(e.target.value)} /></div>
            </div>
            <button className="primary" disabled={!editMode} onClick={importCsv}>Import CSV</button>
          </div>

          <div className="card">
            <h3>Manual user entry</h3>
            <div className="row">
              <div className="col"><label>First name</label><input value={manual.firstName} onChange={(e)=>setManual({ ...manual, firstName:e.target.value })} /></div>
              <div className="col"><label>Last name</label><input value={manual.lastName} onChange={(e)=>setManual({ ...manual, lastName:e.target.value })} /></div>
            </div>
            <div className="row">
              <div className="col"><label>Role</label><select value={manual.role} onChange={(e)=>setManual({ ...manual, role:e.target.value })}><option value="STUDENT">STUDENT</option><option value="TEACHER">TEACHER</option><option value="ADMIN">ADMIN</option><option value="TEACHER_ADMIN">TEACHER_ADMIN</option></select></div>
              <div className="col"><label>Duty</label><input value={manual.duty} onChange={(e)=>setManual({ ...manual, duty:e.target.value })} /></div>
              <div className="col"><label>Schedule #</label><input type="number" value={manual.scheduleNumber} onChange={(e)=>setManual({ ...manual, scheduleNumber:Number(e.target.value) })} /></div>
            </div>
            <div className="row">
              <div className="col"><label>Special Periods</label><input value={manual.specialPeriods} onChange={(e)=>setManual({ ...manual, specialPeriods:e.target.value })} /></div>
              <div className="col"><label>Email (optional)</label><input value={manual.email} onChange={(e)=>setManual({ ...manual, email:e.target.value })} /></div>
            </div>
            <button className="primary" disabled={!editMode} onClick={addManualUser}>Save user</button>
          </div>

          <div className="card">
            <h3>Common Areas</h3>
            <table>
              <thead><tr><th>Period</th><th>Name</th><th>Description</th><th>Maximum</th><th>Enabled</th></tr></thead>
              <tbody>
                {areaDrafts.map((area:any, idx:number) => (
                  <tr key={area.id}>
                    <td>{area.periodNumber}</td>
                    <td>{area.name}</td>
                    <td><input disabled={!editMode} value={area.description || ""} onChange={(e)=>{ const next=[...areaDrafts]; next[idx]={ ...next[idx], description:e.target.value }; setAreaDrafts(next); }} /></td>
                    <td><input disabled={!editMode} type="number" value={area.maxStudents} onChange={(e)=>{ const next=[...areaDrafts]; next[idx]={ ...next[idx], maxStudents:Number(e.target.value) }; setAreaDrafts(next); }} /></td>
                    <td><input disabled={!editMode} style={{width:16}} type="checkbox" checked={!!area.isEnabled} onChange={(e)=>{ const next=[...areaDrafts]; next[idx]={ ...next[idx], isEnabled:e.target.checked }; setAreaDrafts(next); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="primary" disabled={!editMode} onClick={saveCommonAreas}>Save common areas</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
