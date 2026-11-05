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
import { ArrowRight, Trash2, Pencil, Check, X, Users, Receipt, Calculator, Copy, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Member } from "@/lib/settlements";
import {
  computeBalances,
  simplifySettlements,
  generateWhatsAppSummary,
  type ExpenseWithBeneficiaries,
} from "@/lib/settlements";

export const Route = createFileRoute("/group/$groupId")({
  component: GroupPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center" dir="rtl">
      <p className="text-destructive">שגיאה: {error.message}</p>
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
  const [{ data: group, error: gErr }, { data: members, error: mErr }, { data: expenses, error: eErr }, { data: benes, error: bErr }] =
    await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("members").select("*").eq("group_id", groupId).order("created_at"),
      supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("expense_beneficiaries").select("expense_id, member_id"),
    ]);
  if (gErr) throw gErr;
  if (mErr) throw mErr;
  if (eErr) throw eErr;
  if (bErr) throw bErr;
  if (!group) throw notFound();

  const expenseIds = new Set((expenses ?? []).map((e) => e.id));
  const benesFiltered = (benes ?? []).filter((b) => expenseIds.has(b.expense_id));
  const byExpense = new Map<string, string[]>();
  for (const b of benesFiltered) {
    if (!byExpense.has(b.expense_id)) byExpense.set(b.expense_id, []);
    byExpense.get(b.expense_id)!.push(b.member_id);
  }
  const expensesFull: ExpenseWithBeneficiaries[] = (expenses ?? []).map((e) => ({
    ...e,
    beneficiary_ids: byExpense.get(e.id) ?? [],
  }));

  return { group, members: members ?? [], expenses: expensesFull };
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

  const { group, members, expenses } = data;

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
          <BalanceTab groupName={group.name} members={members} expenses={expenses} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

/* ---------------- Members ---------------- */

function MembersTab({ groupId, members, onChange }: { groupId: string; members: Member[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("שם חסר");
      if (trimmed.length > 60) throw new Error("שם ארוך מדי");
      const { error } = await supabase.from("members").insert({
        group_id: groupId,
        name: trimmed,
        phone: phone.trim() || null,
        payment_details: details.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setPhone(""); setDetails("");
      toast.success("החבר נוסף 👋");
      onChange();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", phone: "", details: "" });

  const update = useMutation({
    mutationFn: async (id: string) => {
      const n = edit.name.trim();
      if (!n) throw new Error("שם חסר");
      const { error } = await supabase.from("members").update({
        name: n,
        phone: edit.phone.trim() || null,
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
              <CardContent className="grid gap-2 p-4 md:grid-cols-3">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="שם" maxLength={60} />
                <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="טלפון" maxLength={20} />
                <Input value={edit.details} onChange={(e) => setEdit({ ...edit, details: e.target.value })} placeholder="פרטי תשלום" maxLength={200} />
                <div className="flex gap-2 md:col-span-3">
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
                    {[m.phone, m.payment_details].filter(Boolean).join(" · ") || "אין פרטים נוספים"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="עריכה"
                  onClick={() => {
                    setEditingId(m.id);
                    setEdit({ name: m.name, phone: m.phone ?? "", details: m.payment_details ?? "" });
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
    onSuccess: () => {
      setTitle(""); setAmount(""); setSelected(new Set());
      toast.success("הוצאה נוספה 💸");
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
        <CardHeader><CardTitle>הוצאה חדשה</CardTitle></CardHeader>
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
              {add.isPending ? "מוסיף..." : "הוסף הוצאה"}
            </Button>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { if (confirm("למחוק את ההוצאה?")) remove.mutate(e.id); }}
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
  groupName, members, expenses,
}: {
  groupName: string;
  members: Member[];
  expenses: ExpenseWithBeneficiaries[];
}) {
  const balances = useMemo(() => computeBalances(members, expenses), [members, expenses]);
  const settlements = useMemo(() => simplifySettlements(balances), [balances]);
  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const summary = useMemo(
    () => generateWhatsAppSummary(groupName, balances, settlements, total),
    [groupName, balances, settlements, total]
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
            תשלומים לביצוע
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">🎉 הכל מאוזן, אין צורך בהעברות</p>
          ) : (
            <div className="space-y-2">
              {settlements.map((s, i) => (
                <div key={i} className="rounded-xl border-2 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
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
