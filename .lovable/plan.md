
# חישוב מהיר — Group Expense Manager

## Backend note
You chose "connect to my existing Supabase" but skipped sharing the URL/anon key. To keep building without blocking, I'll use **Lovable Cloud** (Lovable's managed Supabase) and create matching tables (`groups`, `members`, `expenses`, `expense_beneficiaries`). If you later want to point at your own project, share the credentials and I'll swap the client config — the app code stays the same.

No login. Anyone with the link can create/manage groups.

## Database schema (via migration)

```text
groups
  id uuid pk, name text, created_at timestamptz

members
  id uuid pk, group_id uuid fk → groups, name text,
  phone text, payment_details text, created_at

expenses
  id uuid pk, group_id uuid fk, payer_id uuid fk → members,
  title text, amount numeric, created_at

expense_beneficiaries
  expense_id uuid fk (cascade), member_id uuid fk,
  primary key (expense_id, member_id)
```

RLS enabled with permissive policies (open app), plus explicit GRANTs to `anon` and `authenticated` on all four tables.

## Pages / routes

- `/` — Group selector + "Create new group" card. Lists existing groups.
- `/group/$groupId` — Group workspace with tabs:
  - **חברים** (Members): add/remove member (name, phone, payment details)
  - **הוצאות** (Expenses): add expense (title, amount, payer dropdown, participant checkboxes) + expense log
  - **חישוב** (Balance): net-balance table per member, simplified settlements, WhatsApp summary generator with copy button

## Smart Balance Calculator

1. For each expense: split amount equally among selected beneficiaries.
2. Net balance = (total paid by member) − (total owed by member).
3. Simplify settlements: greedy match largest creditor with largest debtor until zero.
4. Generate Hebrew WhatsApp text:

```text
💰 סיכום הוצאות — {group name}

סה"כ: ₪{total}

יתרות:
• {name}: +₪{amount}  /  −₪{amount}

תשלומים לביצוע:
• {debtor} ← {creditor}: ₪{amount}
  פרטי תשלום: {creditor payment_details}
```

Copy-to-clipboard button.

## Design (playful & colorful)

- RTL layout (`dir="rtl"`, `lang="he"`), Hebrew font (Heebo or Rubik via `<link>` in `__root.tsx`).
- Warm gradient palette: coral → peach → soft mint accents on white.
- Rounded 2xl cards, soft shadows, friendly emoji-forward headers (💸 🧾 🤝).
- shadcn/ui components themed via `src/styles.css` tokens (all colors as semantic tokens, no hardcoded hex).
- Playful subtle animations on card add/remove.

## Tech details

- Data fetching: TanStack Query + `createServerFn` handlers in `src/lib/*.functions.ts` using Lovable Cloud's Supabase client.
- Forms: react-hook-form + zod validation (name/phone/amount limits).
- Mutations invalidate `["group", id]` queries after add/delete.
- Head metadata: title "חישוב מהיר — ניהול הוצאות בקבוצה", Hebrew description.

## Out of scope (this iteration)
- Auth / user accounts
- Multi-currency
- Editing existing expenses (only add/delete)
- Receipts / photo upload
