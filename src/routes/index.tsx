import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Plus, Users, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: HomePage,
});

async function fetchGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function HomePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  const createGroup = useMutation({
    mutationFn: async (n: string) => {
      const { data, error } = await supabase
        .from("groups")
        .insert({ name: n })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      setName("");
      toast.success("הקבוצה נוצרה 🎉");
      navigate({ to: "/group/$groupId", params: { groupId: g.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("הקבוצה נמחקה");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleCreate = (ev: React.FormEvent) => {
    ev.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.length > 80) {
      toast.error("שם קבוצה ארוך מדי");
      return;
    }
    createGroup.mutate(trimmed);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-20">
      <header className="mb-10 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-3xl gradient-hero shadow-playful">
          <Calculator className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
          חישוב מהיר
        </h1>
        <p className="mt-3 text-base text-muted-foreground md:text-lg">
          חלקו הוצאות בקבוצה, בלי חשבונות בראש 🧮
        </p>
      </header>

      <Card className="mb-8 border-2 shadow-playful">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-primary" />
            קבוצה חדשה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: טיול לצפון 🏔️"
              className="h-12 rounded-xl text-base"
              maxLength={80}
            />
            <Button
              type="submit"
              disabled={createGroup.isPending || !name.trim()}
              size="lg"
              className="h-12 rounded-xl px-6 font-bold shadow-soft"
            >
              {createGroup.isPending ? "יוצר..." : "צור קבוצה"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
          <Users className="h-5 w-5 text-primary" />
          הקבוצות שלי
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground">טוען...</p>
        ) : groups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              עדיין אין קבוצות. צרו את הראשונה למעלה 👆
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/group/$groupId"
                params={{ groupId: g.id }}
                className="group"
              >
                <Card className="h-full border-2 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-playful">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <h3 className="font-bold text-foreground">{g.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(g.created_at).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="מחק קבוצה"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          if (confirm(`למחוק את הקבוצה "${g.name}"? כל החברים וההוצאות יימחקו.`)) deleteGroup.mutate(g.id);
                        }}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ArrowLeft className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
