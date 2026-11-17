import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function AccountBar({ email }: { email?: string }) {
  const qc = useQueryClient(); const navigate = useNavigate(); const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true); await qc.cancelQueries(); qc.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error("ההתנתקות נכשלה"); setBusy(false); return; }
    await navigate({ to: "/auth", replace: true });
  };
  return <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-all text-sm text-muted-foreground" dir="ltr">{email}</span><Button variant="ghost" size="sm" disabled={busy} onClick={signOut}><LogOut className="h-4 w-4" /> יציאה</Button></div>;
}