import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, ShieldCheck } from "lucide-react";
export function SignIn() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: "/groups", replace: true }); }); }, [navigate]);
  const social = async (provider: "google" | "lovable") => {
    setBusy(true); setError("");
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
      if (result.error) { setError("הכניסה לא הושלמה. נסו שוב."); return; }
      if (result.redirected) return;
      await navigate({ to: "/groups", replace: true });
    } catch { setError("הכניסה לא הושלמה. נסו שוב."); } finally { setBusy(false); }
  };
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` }); if (error) throw error;
        setMessage("אם קיים חשבון עם כתובת זו, יישלח מייל לאיפוס הסיסמה.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } }); if (error) throw error;
        if (data.session) await navigate({ to: "/groups", replace: true }); else setMessage("נשלח מייל לאישור החשבון. לחצו על הקישור במייל לפני הכניסה.");
      } else { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; await navigate({ to: "/groups", replace: true }); }
    } catch { setError(mode === "login" ? "הכניסה נכשלה. בדקו את המייל והסיסמה ושאישרתם את החשבון במייל." : "הפעולה נכשלה. בדקו את הפרטים ונסו שוב."); } finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-md px-5 py-12 md:py-20">
    <header className="mb-8 text-center"><div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero"><Calculator className="h-8 w-8 text-primary-foreground" /></div><h1 className="text-4xl font-extrabold">חישוב מהיר</h1><p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4" /> הקבוצות שלך, בחשבון הפרטי שלך</p></header>
    <h2 className="mb-5 text-xl font-bold">{mode === "signup" ? "יצירת חשבון" : mode === "forgot" ? "איפוס סיסמה" : "כניסה לחשבון"}</h2>
    {mode !== "forgot" && <div className="mb-5 grid gap-3">
      <Button variant="outline" className="google-sign-in h-11" disabled={busy} onClick={() => social("google")}>
        <svg aria-hidden="true" className="h-[18px] w-[18px]" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg> המשך עם Google
      </Button><Button variant="outline" className="h-11" disabled={busy} onClick={() => social("lovable")}><LovableMark className="h-[18px] w-[18px]" /> המשך עם Lovable</Button>
    </div>}
    <form onSubmit={submit} className="space-y-4"><div><Label htmlFor="auth-email">מייל</Label><Input id="auth-email" className="mt-2 h-11" type="email" autoComplete="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {mode !== "forgot" && <div><Label htmlFor="auth-password">סיסמה</Label><Input id="auth-password" className="mt-2 h-11" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "ממתין..." : mode === "signup" ? "צור חשבון" : mode === "forgot" ? "שלח קישור לאיפוס" : "כניסה"}</Button>
    </form><div className="mt-4 flex flex-wrap justify-center gap-2"><Button variant="ghost" disabled={busy} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "אין לך חשבון? הרשמה" : "חזרה לכניסה"}</Button>{mode === "login" && <Button variant="ghost" disabled={busy} onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>שכחתי סיסמה</Button>}</div>
  </main>;
}