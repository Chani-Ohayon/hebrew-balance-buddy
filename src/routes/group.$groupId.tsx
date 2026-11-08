import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Trash2, Pencil, Check, X, Users, Receipt, Calculator, Copy, MessageCircle, Sparkles, Mail } from "lucide-react";
import { calculationKey, gmailReminderUrl, isSettlementPaid, unpaidSettlements, validEmail, type SettlementPayment } from "@/lib/payments";
import { toast } from "sonner";
import type { Member } from "@/lib/settlements";
import {
  computeBalances,
  simplifySettlements,
  generateWhatsAppSummary,
  type ExpenseWithBeneficiaries,
} from "@/lib/settlements";

export const Route = createFileRoute("/group/$groupId")({
  head: () => ({ meta: [
    { title: "התחשבנות ותשלומים בקבוצה — חישוב מהיר" },
    { name: "description", content: "ניהול חברים, הוצאות, תשלומים ותזכורות במייל לקבוצה." },
    { property: "og:title", content: "התחשבנות ותשלומים בקבוצה — חישוב מהיר" },
    { property: "og:description", content: "מעקב הוצאות משותפות ותשלומים לחברי הקבוצה." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GroupPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center" dir="rtl">
      <p className="text-destructive">שגיאה: {(error as Error).message}</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">חזרה</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center" dir="rtl">
      <p>הקבוצה לא נמצאה</p>
      <Link to="/" className="mt-4 inline-block text-primary underline">חזרה</Link>
    </div>
  ),
});

async function fetchGroupBundle(groupId: string) {
  const [{ data: group, error: gErr }, { data: members, error: mErr }, { data: expenses, error: eErr }, { data: benes, error: bErr }, { data: payments, error: pErr }] =
    await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("members").select("*").eq("group_id", groupId).order("created_at"),
      supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("expense_beneficiaries").select("expense_id, member_id"),
      supabase.from("settlement_payments").select("*").eq("group_id", groupId),
    ]);
  if (gErr) throw gErr;
  if (mErr) throw mErr;
  if (eErr) throw eErr;
  if (bErr) throw bErr;
  if (pErr) throw pErr;
  if (!group) throw notFound();

  const expenseIds = new Set((expenses ?? []).map((e) => e.id));
  const benesFiltered = (benes ?? []).filter((b) => expenseIds.has(b.expense_id));
  const byExpense = new Map<string, string[]>();
  for (const b of benesFiltered) {
    if (!byExpense.has(b.expense_id)) byExpense.set(b.expense_id, []);
    byExpense.get(b.expense_id)?.push(b.member_id);
  }
  const expensesFull: ExpenseWithBeneficiaries[] = (expenses ?? []).map((e) => ({
    ...e,
    beneficiary_ids: byExpense.get(e.id) ?? [],
  }));

  return { group, members: members ?? [], expenses: expensesFull, payments: payments ?? [] };
}

function GroupPage() {
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroupBundle(groupId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["group", groupId] });

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">טוען...</div>;
  }
  if (error || !data) {
    return <div className="p-10 text-center text-destructive">שגיאה בטעינה</div>;
  }

  const { group, members, expenses, payments } = data;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <div className="mb-6 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4" />
          כל הקבוצות
        </Link>
      </div>

      <header className="mb-8">
        <div className="rounded-3xl gradient-hero p-6 shadow-playful md:p-8">
          <h1 className="text-3xl font-extrabold text-white md:text-4xl">{group.name}</h1>
          <p className="mt-2 text-sm text-white/90 md:text-base">
            {members.length} חברים · {expenses.length} הוצאות
          </p>
        </div>
      </header>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid h-12 w-full grid-cols-3 rounded-2xl bg-muted p-1">
          <TabsTrigger value="expenses" className="gap-1 rounded-xl font-semibold">
            <Receipt className="h-4 w-4" /> הוצאות
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1 rounded-xl font-semibold">
            <Users className="h-4 w-4" /> חברים
          </TabsTrigger>
          <TabsTrigger value="balance" className="gap-1 rounded-xl font-semibold">
            <Calculator className="h-4 w-4" /> חישוב
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-6 space-y-6">
          <ExpensesTab groupId={groupId} members={members} expenses={expenses} onChange={invalidate} />
        </TabsContent>
        <TabsContent value="members" className="mt-6 space-y-6">
          <MembersTab groupId={groupId} members={members} onChange={invalidate} />
        </TabsContent>
        <TabsContent value="balance" className="mt-6 space-y-6">
          <BalanceTab groupId={groupId} groupName={group.name} members={members} expenses={expenses} payments={payments} onChange={invalidate} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* ---------------- Members ---------------- */

function MembersTab({ groupId, members, onChange }: { groupId: string; members: Member[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("שם חסר");
      if (trimmed.length > 60) throw new Error("שם ארוך מדי");
      if (email.trim() && !validEmail(email)) throw new Error("כתובת מייל לא תקינה");
      const { error } = await supabase.from("members").insert({
        group_id: groupId,
        name: trimmed,
        phone: phone.trim() || null,
        email: email.trim() || null,
        payment_details: details.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setPhone(""); setEmail(""); setDetails("");
      toast.success("החבר נוסף 👋");
      onChange();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", phone: "", email: "", details: "" });

  const update = useMutation({
    mutationFn: async (id: string) => {
      const n = edit.name.trim();
      if (!n) throw new Error("שם חסר");
      if (edit.email.trim() && !validEmail(edit.email)) throw new Error("כתובת מייל לא תקינה");
      const { error } = await supabase.from("members").update({
        name: n,
        phone: edit.phone.trim() || null,
        email: edit.email.trim() || null,
        payment_details: edit.details.trim() || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { setEditingId(null); toast.success("הפרטים עודכנו ✏️"); onChange(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הוסר");
      onChange();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <Card className="border-2 shadow-soft">
        <CardHeader>
          <CardTitle>הוספת חבר</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
            className="grid gap-3 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <Label className="mb-1.5 block">שם *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="דנה" maxLength={60} required />
            </div>
            <div>
              <Label className="mb-1.5 block">טלפון</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" maxLength={20} />
            </div>
            <div>
              <Label htmlFor="member-email" className="mb-1.5 block">מייל</Label>
              <Input id="member-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" maxLength={254} />
            </div>
            <div>
              <Label className="mb-1.5 block">פרטי תשלום</Label>
              <Input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="ביט / פייבוקס / חשבון" maxLength={200} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={add.isPending || !name.trim()} className="w-full rounded-xl font-bold" size="lg">
                {add.isPending ? "מוסיף..." : "הוסף חבר"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {members.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-10 text-center text-muted-foreground">עדיין אין חברים</CardContent></Card>
        ) : (
          members.map((m) => editingId === m.id ? (
            <Card key={m.id} className="border-2 border-primary">
              <CardContent className="grid gap-2 p-4 md:grid-cols-2">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="שם" maxLength={60} />
                <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="טלפון" maxLength={20} />
                <Input aria-label="מייל" type="email" dir="ltr" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="מייל" maxLength={254} />
                <Input value={edit.details} onChange={(e) => setEdit({ ...edit, details: e.target.value })} placeholder="פרטי תשלום" maxLength={200} />
                <div className="flex gap-2 md:col-span-2">
                  <Button size="sm" className="rounded-lg font-bold" disabled={update.isPending || !edit.name.trim()} onClick={() => update.mutate(m.id)}>
                    <Check className="ms-1 h-4 w-4" /> שמור
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="ms-1 h-4 w-4" /> ביטול
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card key={m.id} className="border-2 transition-shadow hover:shadow-soft">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground">{m.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {[m.phone, m.email, m.payment_details].filter(Boolean).join(" · ") || "אין פרטים נוספים"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="עריכה"
                  onClick={() => {
                    setEditingId(m.id);
                    setEdit({ name: m.name, phone: m.phone ?? "", email: m.email ?? "", details: m.payment_details ?? "" });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`להסיר את ${m.name}? כל ההוצאות שלו יימחקו.`)) remove.mutate(m.id);
                  }}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

/* ---------------- Expenses ---------------- */

function ExpensesTab({
  groupId, members, expenses, onChange,
}: {
  groupId: string;
  members: Member[];
  expenses: ExpenseWithBeneficiaries[];
  onChange: () => void;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);

  const startEdit = (e: ExpenseWithBeneficiaries) => {
    setEditId(e.id); setTitle(e.title); setAmount(String(e.amount));
    setPayerId(e.payer_id); setSelected(new Set(e.beneficiary_ids));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => {
    setEditId(null); setTitle(""); setAmount(""); setSelected(new Set());
  };

  const toggleAll = () => {
    if (selected.size === members.length) setSelected(new Set());
    else setSelected(new Set(members.map((m) => m.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const add = useMutation({
    mutationFn: async () => {
      const t = title.trim();
      const amt = parseFloat(amount);
      if (!t) throw new Error("כותרת חסרה");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("סכום לא תקין");
      if (!payerId) throw new Error("בחרו מי שילם");
      if (selected.size === 0) throw new Error("בחרו לפחות משתתף אחד");

      if (editId) {
        const { error: uErr } = await supabase.from("expenses")
          .update({ payer_id: payerId, title: t, amount: amt }).eq("id", editId);
        if (uErr) throw uErr;
        const { error: dErr } = await supabase.from("expense_beneficiaries").delete().eq("expense_id", editId);
        if (dErr) throw dErr;
        const { error: iErr } = await supabase.from("expense_beneficiaries")
          .insert(Array.from(selected).map((mid) => ({ expense_id: editId, member_id: mid })));
        if (iErr) throw iErr;
        return "edit";
      }
      const { data: exp, error } = await supabase
        .from("expenses")
        .insert({ group_id: groupId, payer_id: payerId, title: t, amount: amt })
        .select()
        .single();
      if (error) throw error;
      const rows = Array.from(selected).map((mid) => ({ expense_id: exp.id, member_id: mid }));
      const { error: bErr } = await supabase.from("expense_beneficiaries").insert(rows);
      if (bErr) throw bErr;
    },
    onSuccess: (r) => {
      setTitle(""); setAmount(""); setSelected(new Set()); setEditId(null);
      toast.success(r === "edit" ? "ההוצאה עודכנה ✏️" : "הוצאה נוספה 💸");
      onChange();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("נמחק"); onChange(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  if (members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          קודם הוסיפו חברים בכרטיסייה 'חברים' 👥
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 shadow-soft">
        <CardHeader><CardTitle>{editId ? "עריכת הוצאה ✏️" : "הוצאה חדשה"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">כותרת *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ארוחת ערב 🍕" maxLength={100} required />
              </div>
              <div>
                <Label className="mb-1.5 block">סכום (₪) *</Label>
                <Input
                  type="number" step="0.01" min="0.01" inputMode="decimal"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="120" required
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">מי שילם? *</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger><SelectValue placeholder="בחר חבר" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>משתתפים בהוצאה</Label>
                <button type="button" onClick={toggleAll} className="text-xs font-semibold text-primary hover:underline">
                  {selected.size === members.length ? "נקה" : "בחר הכל"}
                </button>
              </div>
              <div className="grid gap-2 rounded-xl border-2 bg-muted/30 p-3 sm:grid-cols-2">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg bg-card px-3 py-2 transition-colors hover:bg-accent/30"
                  >
                    <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                    <span className="text-sm font-medium">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={add.isPending} size="lg" className="rounded-xl font-bold">
              {add.isPending ? "שומר..." : editId ? "שמור שינויים" : "הוסף הוצאה"}
            </Button>
            {editId && (
              <Button type="button" variant="outline" onClick={cancelEdit} className="rounded-xl">ביטול</Button>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-muted-foreground">היסטוריית הוצאות</h3>
        {expenses.length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-10 text-center text-muted-foreground">עדיין אין הוצאות</CardContent></Card>
        ) : (
          expenses.map((e) => (
            <Card key={e.id} className="border-2 transition-shadow hover:shadow-soft">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-bold text-foreground">{e.title}</p>
                    <p className="whitespace-nowrap text-lg font-extrabold text-primary">
                      ₪{Number(e.amount).toFixed(2).replace(/\.00$/, "")}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    שילם: <span className="font-semibold">{memberById.get(e.payer_id)?.name ?? "—"}</span>
                    {" · "}
                    עבור: {e.beneficiary_ids.map((id) => memberById.get(id)?.name).filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => startEdit(e)} aria-label="עריכה">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { if (confirm("למחוק את ההוצאה?")) { if (editId === e.id) cancelEdit(); remove.mutate(e.id); } }}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

/* ---------------- Balance ---------------- */

function BalanceTab({
  groupId, groupName, members, expenses, payments, onChange,
}: {
  groupId: string;
  groupName: string;
  members: Member[];
  expenses: ExpenseWithBeneficiaries[];
  payments: SettlementPayment[];
  onChange: () => void;
}) {
  const balances = useMemo(() => computeBalances(members, expenses), [members, expenses]);
  const settlements = useMemo(() => simplifySettlements(balances), [balances]);
  const key = useMemo(() => calculationKey(members, expenses), [members, expenses]);
  const unpaid = useMemo(() => unpaidSettlements(settlements, payments, key), [settlements, payments, key]);
  const gmailUrl = useMemo(() => gmailReminderUrl(groupName, unpaid), [groupName, unpaid]);
  const missingEmails = [...new Set(unpaid.filter((s) => !validEmail(s.from.email ?? "")).map((s) => s.from.name))];
  const setPaid = useMutation({
    mutationFn: async ({ settlement, isPaid }: { settlement: (typeof settlements)[number]; isPaid: boolean }) => {
      const { error } = await supabase.from("settlement_payments").upsert({
        group_id: groupId, from_member_id: settlement.from.id, to_member_id: settlement.to.id,
        amount: settlement.amount, calculation_key: key, is_paid: isPaid, updated_at: new Date().toISOString(),
      }, { onConflict: "group_id,from_member_id,to_member_id,calculation_key" });
      if (error) throw error;
    },
    onSuccess: async () => { await onChange(); toast.success("מצב התשלום עודכן"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const summary = useMemo(
    () => generateWhatsAppSummary(groupName, balances, unpaid, total)
      .replace("🎉 אין צורך בהעברות — הכל מאוזן!", settlements.length ? "🎉 כל התשלומים סומנו כשולמו!" : "🎉 אין צורך בהעברות — הכל מאוזן!"),
    [groupName, balances, unpaid, settlements.length, total]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("הועתק! מוכן להדבקה בוואטסאפ 📋");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  };

  const openWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-muted-foreground">
          הוסיפו חברים והוצאות כדי לראות חישוב
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>יתרות</span>
            <span className="text-sm font-normal text-muted-foreground">
              סה"כ: ₪{total.toFixed(2).replace(/\.00$/, "")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {balances.map((b) => {
              const net = Math.round(b.net * 100) / 100;
              const positive = net > 0.01;
              const balanced = Math.abs(net) < 0.01;
              return (
                <div key={b.member.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                  <div>
                    <p className="font-bold">{b.member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      שילם ₪{b.paid.toFixed(2).replace(/\.00$/, "")} · חלקו ₪{b.owed.toFixed(2).replace(/\.00$/, "")}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-sm font-bold " +
                      (balanced
                        ? "bg-muted text-muted-foreground"
                        : positive
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive")
                    }
                  >
                    {balanced ? "מאוזן" : positive ? `+₪${net.toFixed(2).replace(/\.00$/, "")}` : `−₪${(-net).toFixed(2).replace(/\.00$/, "")}`}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            מעקב תשלומים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settlements.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">שולמו {settlements.length - unpaid.length} מתוך {settlements.length} · נותרו ₪{unpaid.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}</p>
              <Button variant="outline" disabled={!gmailUrl || setPaid.isPending} onClick={() => { if (gmailUrl) window.open(gmailUrl, "_blank", "noopener,noreferrer"); }}>
                <Mail className="ms-2 h-4 w-4" /> תזכורת ב־Gmail
              </Button>
            </div>
          )}
          {missingEmails.length > 0 && <p className="break-words text-sm text-destructive">חסרה כתובת מייל: {missingEmails.join(", ")}</p>}
          {payments.some((p) => p.is_paid && p.calculation_key !== key) && !payments.some((p) => p.calculation_key === key) && (
            <p className="text-sm text-muted-foreground">החישוב השתנה מאז סימון התשלומים הקודם. יש לבדוק מחדש אילו העברות שולמו.</p>
          )}
          {settlements.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">🎉 הכל מאוזן, אין צורך בהעברות</p>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div key={i} className="rounded-xl border-2 bg-card p-4" data-testid={`payment-${s.from.id}-${s.to.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-bold">
                      <span className="text-destructive">{s.from.name}</span>
                      <span className="mx-2 text-muted-foreground">←</span>
                      <span className="text-success">{s.to.name}</span>
                    </p>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">
                      ₪{s.amount.toFixed(2).replace(/\.00$/, "")}
                    </span>
                  </div>
                  {s.to.payment_details && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      פרטי תשלום: <span className="font-semibold text-foreground">{s.to.payment_details}</span>
                    </p>
                  )}
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <Checkbox aria-label={`שולם: ${s.from.name} ל${s.to.name}`} checked={isSettlementPaid(s, payments, key)} disabled={setPaid.isPending}
                      onCheckedChange={(checked) => setPaid.mutate({ settlement: s, isPaid: checked === true })} />
                    <span className={isSettlementPaid(s, payments, key) ? "text-success" : "text-destructive"}>
                      {isSettlementPaid(s, payments, key) ? "שולם" : "טרם שולם"}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 shadow-playful">
        <CardHeader>
          <CardTitle>סיכום לוואטסאפ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-right text-sm font-sans leading-relaxed">
            {summary}
          </pre>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={copy} size="lg" className="flex-1 rounded-xl font-bold">
              <Copy className="ms-2 h-4 w-4" /> העתק
            </Button>
            <Button onClick={openWhatsApp} size="lg" variant="secondary" className="flex-1 rounded-xl font-bold">
              <MessageCircle className="ms-2 h-4 w-4" /> פתח בוואטסאפ
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
