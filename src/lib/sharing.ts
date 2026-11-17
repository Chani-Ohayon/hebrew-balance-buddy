import type { Member, ExpenseWithBeneficiaries } from './settlements';
import type { SettlementPayment } from './payments';

export interface SharedGroup {
  group: { id: string; name: string };
  members: Member[];
  expenses: ExpenseWithBeneficiaries[];
  payments: SettlementPayment[];
}

export function validShareToken(token: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}