import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/reset-password")({ head: () => ({ meta: [
  { title: "איפוס סיסמה — חישוב מהיר" }, { name: "description", content: "קביעת סיסמה חדשה לחשבון שלך." },
  { property: "og:title", content: "איפוס סיסמה — חישוב מהיר" }, { property: "og:description", content: "חזרה בטוחה לחשבון שלך." },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
] }), component: ResetPassword });
function ResetPassword() {
  const [valid, setValid] = useState(false); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [done, setDone] = useState(false);
  useEffect(() => { setValid(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery"); }, []);
  return <main className="mx-auto max-w-md px-5 py-16"><h1 className="mb-6 text-3xl font-bold">איפוס סיסמה</h1>
    {!valid ? <p>פתחו את הקישור שנשלח במייל לאיפוס הסיסמה.</p> : done ? <p>הסיסמה עודכנה בהצלחה.</p> : <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); if (password !== confirmation) { setMessage("הסיסמאות אינן תואמות"); return; } setBusy(true);
      const { error } = await supabase.auth.updateUser({ password }); setBusy(false);
      if (error) setMessage("הקישור אינו תקף או שהעדכון נכשל. בקשו קישור חדש."); else setDone(true);
    }}><Label htmlFor="new-password">סיסמה חדשה</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      <Label htmlFor="confirm-password">אימות סיסמה</Label><Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      {message && <p role="alert" className="text-destructive">{message}</p>}<Button disabled={busy} type="submit">שמור סיסמה</Button></form>}
    <Link to="/auth" className="mt-5 inline-block text-primary underline">חזרה לכניסה</Link></main>;
}