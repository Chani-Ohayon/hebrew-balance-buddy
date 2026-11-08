import type { Tables } from "@/integrations/supabase/types";
import type { ExpenseWithBeneficiaries, Member, Settlement } from "./settlements";

export type SettlementPayment = Tables<"settlement_payments">;

export function calculationKey(members: Member[], expenses: ExpenseWithBeneficiaries[]): string {
  return JSON.stringify({
    members: members.map((m) => m.id).sort(),
    expenses: expenses.map((e) => [e.id, Number(e.amount), e.payer_id, [...e.beneficiary_ids].sort()])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });
}

export function isSettlementPaid(s: Settlement, payments: SettlementPayment[], key: string): boolean {
  return payments.some((p) => p.calculation_key === key && p.from_member_id === s.from.id &&
    p.to_member_id === s.to.id && Number(p.amount) === s.amount && p.is_paid);
}

export function unpaidSettlements(settlements: Settlement[], payments: SettlementPayment[], key: string): Settlement[] {
  return settlements.filter((s) => !isSettlementPaid(s, payments, key));
}

export function validEmail(value: string): boolean {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value.trim());
}

export function gmailReminderUrl(groupName: string, unpaid: Settlement[]): string | null {
  const withEmail = unpaid.filter((s) => validEmail(s.from.email ?? ""));
  const recipients = [...new Set(withEmail.map((s) => s.from.email?.trim()).filter((email): email is string => Boolean(email)))];
  if (recipients.length === 0) return null;
  const body = [
    `שלום,`, "", `תזכורת לתשלום עבור הקבוצה ״${groupName}״:`, "",
    ...withEmail.flatMap((s) => [
      `${s.from.name}: נותר להעביר ₪${s.amount.toFixed(2)} ל${s.to.name}.`,
      ...(s.to.payment_details?.trim() ? [`פרטי תשלום: ${s.to.payment_details.trim()}`] : []),
      ...(s.to.phone?.trim() ? [`טלפון: ${s.to.phone.trim()}`] : []), "",
    ]),
    "אם כבר שילמתם, אנא עדכנו אותנו. תודה!",
  ].join("\n");
  const params = new URLSearchParams({ view: "cm", fs: "1", bcc: recipients.join(","),
    su: `תזכורת לתשלום — ${groupName}`, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
}