import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { Eye, Users, Receipt, Calculator } from 'lucide-react';
import { readSharedGroup } from '@/lib/sharing.functions';
import { computeBalances, simplifySettlements } from '@/lib/settlements';
import { calculationKey, isSettlementPaid } from '@/lib/payments';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const sharedOptions = (token: string) => queryOptions({ queryKey: ['shared-group', token], queryFn: () => readSharedGroup({ data: { token } }), staleTime: 0, gcTime: 0 });
export const Route = createFileRoute('/share/$token')({
  head: () => ({ meta: [
    { title: 'צפייה בקבוצה משותפת — חישוב מהיר' },
    { name: 'description', content: 'צפייה בלבד בהוצאות ובתשלומים של קבוצה ששיתפו איתך.' },
    { property: 'og:title', content: 'צפייה בקבוצה משותפת — חישוב מהיר' },
    { property: 'og:description', content: 'הוצאות והתחשבנות בקבוצה משותפת לצפייה בלבד.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow' },
  ] }),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(sharedOptions(params.token)),
  component: SharedPage,
  errorComponent: () => <main className="p-10 text-center">לא ניתן לפתוח את הקישור. ייתכן שבוטל או שאינו תקין.</main>,
});

function SharedPage() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(sharedOptions(token));
  if (!data) return <main className="p-10 text-center">קישור הצפייה אינו פעיל או שהקבוצה נמחקה.</main>;
  const { group, members, expenses, payments } = data;
  const names = new Map(members.map(m => [m.id, m.name]));
  const balances = computeBalances(members, expenses);
  const settlements = simplifySettlements(balances);
  const key = calculationKey(members, expenses);
  return <main className="mx-auto max-w-4xl px-4 py-8 md:py-12">
    <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Eye className="h-4 w-4" />חישוב מהיר · צפייה בלבד</p>
    <header className="mb-6 border-b pb-6"><h1 className="break-words text-3xl font-extrabold text-foreground">{group.name}</h1><p className="mt-2 text-muted-foreground">{members.length} חברים · {expenses.length} הוצאות</p></header>
    <Tabs defaultValue="expenses">
      <TabsList className="grid h-12 w-full grid-cols-3">
        <TabsTrigger value="expenses" className="gap-1"><Receipt className="h-4 w-4" />הוצאות</TabsTrigger>
        <TabsTrigger value="members" className="gap-1"><Users className="h-4 w-4" />חברים</TabsTrigger>
        <TabsTrigger value="balance" className="gap-1"><Calculator className="h-4 w-4" />חישוב</TabsTrigger>
      </TabsList>
      <TabsContent value="expenses" className="mt-6 space-y-3">
        {expenses.length === 0 && <p className="text-muted-foreground">עדיין אין הוצאות</p>}
        {expenses.map(e => <article key={e.id} className="rounded-lg border bg-card p-4"><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words font-bold">{e.title}</h2><span className="shrink-0 font-bold text-primary">₪{Number(e.amount).toFixed(2)}</span></div><p className="mt-2 break-words text-sm text-muted-foreground">שילם: {names.get(e.payer_id)} · עבור: {e.beneficiary_ids.map(id => names.get(id)).join(', ')}</p></article>)}
      </TabsContent>
      <TabsContent value="members" className="mt-6 space-y-3">{members.map(m => <article key={m.id} className="rounded-lg border bg-card p-4 font-bold">{m.name}</article>)}</TabsContent>
      <TabsContent value="balance" className="mt-6 space-y-6">
        <section><h2 className="mb-3 font-bold">יתרות · סה״כ ₪{expenses.reduce((sum,e) => sum+Number(e.amount),0).toFixed(2)}</h2>{balances.map(b => <div key={b.member.id} className="flex justify-between gap-3 border-b py-3"><span className="break-words">{b.member.name}</span><span className="shrink-0 font-bold">{b.net > 0 ? '+' : ''}₪{b.net.toFixed(2)}</span></div>)}</section>
        <section><h2 className="mb-3 font-bold">מעקב תשלומים</h2>{settlements.length === 0 && <p>הכל מאוזן, אין צורך בהעברות</p>}{settlements.map((s,i) => <article key={i} className="mb-3 rounded-lg border bg-card p-4"><p className="break-words font-bold">{s.from.name} ← {s.to.name} · ₪{s.amount.toFixed(2)}</p><p className={isSettlementPaid(s,payments,key) ? 'mt-2 text-success' : 'mt-2 text-destructive'}>{isSettlementPaid(s,payments,key) ? 'שולם' : 'טרם שולם'}</p></article>)}</section>
      </TabsContent>
    </Tabs>
  </main>;
}