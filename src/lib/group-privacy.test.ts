import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { beforeAll, describe, expect, it } from "vitest";

// Live integration test: set PRIVACY_TEST_DIR to a temporary directory containing
// config.json and two independently authenticated test-account session files.
const dir = process.env.PRIVACY_TEST_DIR;
describe.skipIf(!dir)("Live owner-only group access", () => {
  let owner: SupabaseClient<Database>;
  let other: SupabaseClient<Database>;
  let anon: SupabaseClient<Database>;
  let groupId = "";
  let ownerId = "";
  let otherId = "";
  beforeAll(() => {
    if (!dir) throw new Error("PRIVACY_TEST_DIR required");
    const config = JSON.parse(readFileSync(`${dir}/config.json`, "utf8"));
    const a = JSON.parse(readFileSync(`${dir}/owner-session.json`, "utf8"));
    const b = JSON.parse(readFileSync(`${dir}/other-session.json`, "utf8"));
    groupId = JSON.parse(readFileSync(`${dir}/group.json`, "utf8")).id;
    ownerId = a.session.user.id; otherId = b.session.user.id;
    const client = (token?: string) => createClient<Database>(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    });
    owner = client(a.session.access_token); other = client(b.session.access_token); anon = client();
  });
  it("creator can read the group with their ownership persisted", async () => {
    const { data, error } = await owner.from("groups").select("owner_id").eq("id", groupId).single();
    expect(error).toBeNull(); expect(data?.owner_id).toBe(ownerId);
  });
  for (const table of ["groups", "members", "expenses", "expense_beneficiaries", "settlement_payments"] as const) {
    it(`another account cannot read ${table}`, async () => {
      const { data, error } = await other.from(table).select("*");
      expect(error).toBeNull(); expect(data).toEqual([]);
    });
    it(`anonymous visitors cannot read ${table}`, async () => {
      const { data, error } = await anon.from(table).select("*");
      expect(error).not.toBeNull(); expect(data).toBeNull();
    });
  }
  it("other users cannot update or delete the group", async () => {
    const update = await other.from("groups").update({ name: "Stolen" }).eq("id", groupId).select();
    const remove = await other.from("groups").delete().eq("id", groupId).select();
    expect(update.data).toEqual([]); expect(remove.data).toEqual([]);
    const original = await owner.from("groups").select("name").eq("id", groupId).single();
    expect(original.data?.name).toBe("קבוצה פרטית לבדיקה");
  });
  it("another user cannot insert members into the group", async () => {
    const { error } = await other.from("members").insert({ group_id: groupId, name: "Intruder" });
    expect(error?.code).toBe("42501");
  });
  it("creator cannot assign ownership to another account", async () => {
    const { error } = await owner.from("groups").update({ owner_id: otherId }).eq("id", groupId);
    expect(error?.code).toBe("42501");
  });
  it("shared link allows anonymous read only, omits contact and bank fields, and can be revoked", async () => {
    const created = await owner.from('group_share_links').upsert({ group_id: groupId }).select('token').single();
    expect(created.error).toBeNull();
    if (!created.data) throw new Error('No share link');
    const token = created.data.token;
    const shared = await anon.rpc('read_shared_group', { share_token: token });
    expect(shared.error).toBeNull();
    const payload = shared.data as unknown as { group: { id: string }; members: { email: null; phone: null; payment_details: null }[] };
    expect(payload.group.id).toBe(groupId);
    expect(payload.members.length).toBe(2);
    for (const member of payload.members) {
      expect(member.email).toBeNull(); expect(member.phone).toBeNull(); expect(member.payment_details).toBeNull();
    }
    const write = await anon.from('expenses').update({ amount: 999 }).eq('group_id', groupId).select();
    expect(write.error).not.toBeNull();
    const changeLink = await other.from('group_share_links').delete().eq('group_id', groupId).select();
    expect(changeLink.data).toEqual([]);
    const revoked = await owner.from('group_share_links').delete().eq('group_id', groupId);
    expect(revoked.error).toBeNull();
    const hidden = await anon.rpc('read_shared_group', { share_token: token });
    expect(hidden.data).toBeNull();
  });
});