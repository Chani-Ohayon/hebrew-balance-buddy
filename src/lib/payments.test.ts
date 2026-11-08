import { describe, expect, it } from "vitest";
import { calculationKey, gmailReminderUrl, isSettlementPaid, unpaidSettlements } from "./payments";
import type { SettlementPayment } from "./payments";
import type { ExpenseWithBeneficiaries, Member, Settlement } from "./settlements";

const member = (id: string, email: string | null): Member => ({ id, group_id: "group", name: id, email, phone: null, payment_details: "ביט", created_at: "2026-11-08" });
const a = member("דנה", "dana@example.com");
const b = member("יוסי", "yossi@example.com");
const c = member("חני", null);
const settlements: Settlement[] = [{ from: a, to: c, amount: 60 }, { from: b, to: c, amount: 30 }, { from: c, to: a, amount: 10 }];
const paid: SettlementPayment = { id: "paid", group_id: "group", from_member_id: a.id, to_member_id: c.id, amount: 60, calculation_key: "key", is_paid: true, updated_at: "2026-11-08" };

describe("Payment tracking", () => {
  it("starts unrecorded transfers as unpaid", () => {
    expect(isSettlementPaid(settlements[0], [], "key")).toBe(false);
  });
  it("excludes paid transfers from outstanding payments", () => {
    expect(unpaidSettlements(settlements, [paid], "key").map((s) => s.amount)).toEqual([30, 10]);
  });
  it("restores unpaid state when a payment is unmarked", () => {
    expect(isSettlementPaid(settlements[0], [{ ...paid, is_paid: false }], "key")).toBe(false);
  });
  it("does not reuse payment status for a changed calculation", () => {
    expect(isSettlementPaid(settlements[0], [paid], "changed")).toBe(false);
    const expense: ExpenseWithBeneficiaries = { id: "expense", group_id: "group", payer_id: c.id, title: "אוכל", amount: 120, beneficiary_ids: [a.id, c.id], created_at: "2026-11-08" };
    expect(calculationKey([a, c], [expense])).not.toBe(calculationKey([a, c], [{ ...expense, amount: 150 }]));
  });
  it("keeps payment status after member contact details change", () => {
    expect(calculationKey([a, c], [])).toBe(calculationKey([{ ...a, email: "new@example.com" }, c], []));
  });
  it("opens Gmail for only unpaid members with emails", () => {
    const url = gmailReminderUrl("טיול", unpaidSettlements(settlements, [paid], "key"));
    expect(url).not.toBeNull();
    const params = new URL(url ?? "https://example.com").searchParams;
    expect(params.get("bcc")).toBe("yossi@example.com");
    expect(params.get("to")).toBeNull();
    expect(params.get("body")).toContain("₪30.00");
  });
  it("does not open an empty draft when no unpaid member has email", () => {
    expect(gmailReminderUrl("טיול", [settlements[2]])).toBeNull();
  });
});