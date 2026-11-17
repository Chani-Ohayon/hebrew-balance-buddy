import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, Link2Off } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function GroupShare({ groupId, userId }: { groupId: string; userId: string }) {
  const qc = useQueryClient();
  const queryKey = ['share-link', groupId, userId];
  const { data: link } = useQuery({ queryKey, queryFn: async () => {
    const { data, error } = await supabase.from('group_share_links').select('token').eq('group_id', groupId).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const create = useMutation({ mutationFn: async () => {
    const { data, error } = await supabase.from('group_share_links').upsert({ group_id: groupId }, { onConflict: 'group_id', ignoreDuplicates: true }).select('token').maybeSingle();
    if (error) throw error;
    return data;
  }, onSuccess: async () => { await qc.invalidateQueries({ queryKey }); toast.success('קישור הצפייה נוצר'); }, onError: () => toast.error('יצירת הקישור נכשלה') });
  const revoke = useMutation({ mutationFn: async () => {
    const { error } = await supabase.from('group_share_links').delete().eq('group_id', groupId);
    if (error) throw error;
  }, onSuccess: async () => { await qc.invalidateQueries({ queryKey }); toast.success('הקישור בוטל'); }, onError: () => toast.error('ביטול הקישור נכשל') });
  const url = link ? `${window.location.origin}/share/${link.token}` : '';
  return <section className="mb-6 space-y-3 border-b pb-5">
    {link ? <>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="קישור לצפייה בלבד" dir="ltr" readOnly value={url} className="w-full min-w-0 sm:flex-1" />
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success('קישור הצפייה הועתק'); } catch { toast.error('לא ניתן להעתיק; אפשר לבחור את הקישור'); } }}><Copy className="ms-2 h-4 w-4" />העתק קישור</Button>
        <Button variant="ghost" disabled={revoke.isPending} onClick={() => { if (confirm('לבטל את קישור הצפייה? מי שקיבל אותו לא יוכל לפתוח אותו שוב.')) revoke.mutate(); }}><Link2Off className="ms-2 h-4 w-4" />בטל שיתוף</Button>
      </div>
      <p className="text-xs text-muted-foreground">לכל מי שמחזיק בקישור יש גישה לצפייה בלבד. פרטי קשר ובנק אינם מוצגים.</p>
    </> : <Button variant="outline" disabled={create.isPending} onClick={() => create.mutate()}><Link2 className="ms-2 h-4 w-4" />{create.isPending ? 'יוצר קישור...' : 'צור קישור לצפייה בלבד'}</Button>}
  </section>;
}