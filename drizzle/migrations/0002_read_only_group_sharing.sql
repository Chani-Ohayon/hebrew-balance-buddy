CREATE TABLE public.group_share_links (
 group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_share_links TO authenticated;
GRANT ALL ON public.group_share_links TO service_role;
ALTER TABLE public.group_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_share_links ON public.group_share_links FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id=group_id AND g.owner_id=(SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id=group_id AND g.owner_id=(SELECT auth.uid())));
CREATE FUNCTION public.read_shared_group(share_token uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object(
 'group',jsonb_build_object('id',g.id,'name',g.name),
 'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'group_id',m.group_id,'name',m.name,'created_at',m.created_at,'email',null,'phone',null,'payment_details',null) ORDER BY m.created_at) FROM public.members m WHERE m.group_id=g.id),'[]'::jsonb),
 'expenses',COALESCE((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('beneficiary_ids',COALESCE((SELECT jsonb_agg(b.member_id ORDER BY b.member_id) FROM public.expense_beneficiaries b WHERE b.expense_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC) FROM public.expenses e WHERE e.group_id=g.id),'[]'::jsonb),
 'payments',COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.settlement_payments p WHERE p.group_id=g.id),'[]'::jsonb)
 ) FROM public.group_share_links s JOIN public.groups g ON g.id=s.group_id WHERE s.token=share_token;
$$;
REVOKE ALL ON FUNCTION public.read_shared_group(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_shared_group(uuid) TO anon, authenticated, service_role;