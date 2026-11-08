ALTER TABLE public.members ADD COLUMN email text;
CREATE TABLE public.settlement_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  to_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  calculation_key text NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, from_member_id, to_member_id, calculation_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_payments TO anon, authenticated;
GRANT ALL ON public.settlement_payments TO service_role;
ALTER TABLE public.settlement_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public all settlement_payments" ON public.settlement_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);