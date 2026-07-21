import type { Tables } from "@/integrations/supabase/types";

export type Member = Tables<"members">;
export type Expense = Tables<"expenses">;
export type ExpenseBeneficiary = Tables<"expense_beneficiaries">;

export interface ExpenseWithBeneficiaries extends Expense {
  beneficiary_ids: string[];
}

export interface MemberBalance {
  member: Member;
  paid: number;
  owed: number;
  net: number; // paid - owed
}

export interface Settlement {
  from: Member;
  to: Member;
  amount: number;
}

const EPS = 0.01;

export function computeBalances(
  members: Member[],
  expenses: ExpenseWithBeneficiaries[]
): MemberBalance[] {
  const map = new Map<string, MemberBalance>();
  for (const m of members) {
    map.set(m.id, { member: m, paid: 0, owed: 0, net: 0 });
  }
  for (const e of expenses) {
    const amount = Number(e.amount);
    const payer = map.get(e.payer_id);
    if (payer) payer.paid += amount;
    if (e.beneficiary_ids.length === 0) continue;
    const share = amount / e.beneficiary_ids.length;
    for (const bId of e.beneficiary_ids) {
      const b = map.get(bId);
      if (b) b.owed += share;
    }
  }
  for (const b of map.values()) {
    b.net = b.paid - b.owed;
  }
  return Array.from(map.values());
}

export function simplifySettlements(balances: MemberBalance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.net > EPS)
    .map((b) => ({ member: b.member, amount: b.net }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = balances
    .filter((b) => b.net < -EPS)
    .map((b) => ({ member: b.member, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amount, c.amount);
    settlements.push({
      from: d.member,
      to: c.member,
      amount: Math.round(pay * 100) / 100,
    });
    d.amount -= pay;
    c.amount -= pay;
    if (d.amount < EPS) i++;
    if (c.amount < EPS) j++;
  }
  return settlements;
}

function formatCurrency(n: number): string {
  return `₪${n.toFixed(2).replace(/\.00$/, "")}`;
}

export function generateWhatsAppSummary(
  groupName: string,
  balances: MemberBalance[],
  settlements: Settlement[],
  totalExpenses: number
): string {
  const lines: string[] = [];
  lines.push(`💰 *סיכום הוצאות — ${groupName}*`);
  lines.push("");
  lines.push(`סה"כ הוצאות: ${formatCurrency(totalExpenses)}`);
  lines.push("");

  if (balances.length > 0) {
    lines.push("*יתרות:*");
    for (const b of balances) {
      const net = Math.round(b.net * 100) / 100;
      if (Math.abs(net) < EPS) {
        lines.push(`• ${b.member.name}: מאוזן ✅`);
      } else if (net > 0) {
        lines.push(`• ${b.member.name}: מגיע לו +${formatCurrency(net)} 🟢`);
      } else {
        lines.push(`• ${b.member.name}: חייב ${formatCurrency(-net)} 🔴`);
      }
    }
    lines.push("");
  }

  if (settlements.length === 0) {
    lines.push("🎉 אין צורך בהעברות — הכל מאוזן!");
  } else {
    lines.push("*תשלומים לביצוע:*");
    for (const s of settlements) {
      lines.push(`💸 ${s.from.name} ← ${s.to.name}: ${formatCurrency(s.amount)}`);
      if (s.to.payment_details && s.to.payment_details.trim()) {
        lines.push(`   פרטי תשלום של ${s.to.name}: ${s.to.payment_details.trim()}`);
      }
      if (s.to.phone && s.to.phone.trim()) {
        lines.push(`   📱 ${s.to.phone.trim()}`);
      }
    }
  }
  lines.push("");
  lines.push("_חושב באמצעות חישוב מהיר_");
  return lines.join("\n");
}
