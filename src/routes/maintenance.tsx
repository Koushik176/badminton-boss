import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, Pencil, Plus, RotateCcw, Trash2, Wrench, X } from "lucide-react";
import { api, useAuth } from "@/lib/api";
import {
  CATEGORY_LABEL,
  KIND_LABEL,
  MAINTENANCE_KINDS,
  RESOURCE_CATEGORIES,
  formatMoney,
  type MaintenanceSummary,
} from "@/lib/engine/maintenance";
import { AppShell, Empty } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DuesPanel } from "@/components/DuesPanel";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance — Smash Court" },
      {
        name: "description",
        content: "Maintenance and repair expenses for shared racquets, shuttles, nets and ground.",
      },
      { property: "og:title", content: "Maintenance — Smash Court" },
      {
        property: "og:description",
        content: "Maintenance and repair expenses for shared racquets, shuttles, nets and ground.",
      },
    ],
  }),
  component: MaintenancePage,
});

type Resource = {
  id: string;
  name: string;
  category: string;
  notes: string | null;
  active: boolean;
};
type Expense = {
  id: string;
  resourceId: string;
  resourceName: string;
  category: string;
  kind: string;
  description: string;
  cost: number;
  date: string;
  paidBy: string | null;
};
type Overview = { resources: Resource[]; records: Expense[]; summary: MaintenanceSummary };

const today = () => new Date().toISOString().slice(0, 10);
const field = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const catLabel = (c: string) => CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c;
const kindLabel = (k: string) => KIND_LABEL[k as keyof typeof KIND_LABEL] ?? k;

function MaintenancePage() {
  const { isOrganizer } = useAuth();
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ resourceId: "", kind: "", from: "", to: "" });
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [tab, setTab] = useState("expenses");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [filters]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["maintenance", query],
    queryFn: () => api<Overview>(`/maintenance${query}`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["maintenance"] });

  const monthKey = today().slice(0, 7);
  const thisMonth = data?.summary.byMonth.find((m) => m.key === monthKey)?.total ?? 0;
  const maxCat = Math.max(1, ...(data?.summary.byCategory.map((c) => c.total) ?? [0]));

  async function remove(e: Expense) {
    if (!confirm(`Delete this ${formatMoney(e.cost)} expense for ${e.resourceName}?`)) return;
    try {
      await api(`/maintenance/${e.id}`, { method: "DELETE" });
      toast.success("Expense deleted");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <AppShell
      title="Maintenance"
      actions={
        isOrganizer && tab === "expenses" ? (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Record expense
          </Button>
        ) : null
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="expenses">Expenses &amp; equipment</TabsTrigger>
          <TabsTrigger value="splits">Splits</TabsTrigger>
        </TabsList>
        <TabsContent value="splits">
          <DuesPanel isOrganizer={isOrganizer} />
        </TabsContent>
        <TabsContent value="expenses">
          {error ? (
            <p className="text-destructive">{(error as Error).message}</p>
          ) : isLoading || !data ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Total spent" value={formatMoney(data.summary.total)} />
                <Stat label={`This month (${monthKey})`} value={formatMoney(thisMonth)} />
                <Stat label="Expenses recorded" value={String(data.summary.count)} />
              </div>

              <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label className="text-xs">Resource</Label>
                  <select
                    className={field}
                    value={filters.resourceId}
                    onChange={(e) => setFilters({ ...filters, resourceId: e.target.value })}
                  >
                    <option value="">All</option>
                    {data.resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <select
                    className={field}
                    value={filters.kind}
                    onChange={(e) => setFilters({ ...filters, kind: e.target.value })}
                  >
                    <option value="">All</option>
                    {MAINTENANCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">From</Label>
                  <Input
                    type="date"
                    value={filters.from}
                    onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input
                    type="date"
                    value={filters.to}
                    onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters({ resourceId: "", kind: "", from: "", to: "" })}
                  >
                    <X className="h-4 w-4" /> Clear filters
                  </Button>
                </div>
              </div>

              {data.summary.byCategory.length > 0 && (
                <section className="rounded-xl border bg-card p-4">
                  <h2 className="mb-3 font-display text-lg font-bold uppercase">
                    Spend by category
                  </h2>
                  <ul className="space-y-2">
                    {data.summary.byCategory.map((c) => (
                      <li key={c.key} className="text-sm">
                        <div className="mb-1 flex justify-between">
                          <span>
                            {catLabel(c.key)}{" "}
                            <span className="text-muted-foreground">({c.count})</span>
                          </span>
                          <span className="font-semibold tabular-nums">{formatMoney(c.total)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${(c.total / maxCat) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {editing && isOrganizer && (
                <ExpenseForm
                  key={editing === "new" ? "new" : editing.id}
                  resources={data.resources}
                  expense={editing === "new" ? null : editing}
                  onClose={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null);
                    refresh();
                  }}
                />
              )}

              <section>
                <h2 className="mb-2 font-display text-lg font-bold uppercase">Expenses</h2>
                {data.records.length === 0 ? (
                  <Empty title="No maintenance expenses yet">
                    {isOrganizer
                      ? "Record a repair, restring or purchase with “Record expense”."
                      : "Nothing has been recorded for these filters."}
                  </Empty>
                ) : (
                  <ul className="divide-y rounded-xl border bg-card">
                    {data.records.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                        <span className="w-24 text-xs tabular-nums text-muted-foreground">
                          {e.date}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {e.resourceName}{" "}
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              {kindLabel(e.kind)}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {e.description}
                            {e.paidBy ? ` · paid by ${e.paidBy}` : ""}
                          </p>
                        </div>
                        <span className="font-display text-lg font-bold tabular-nums">
                          {formatMoney(e.cost)}
                        </span>
                        {isOrganizer && (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Edit expense"
                              onClick={() => setEditing(e)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Delete expense"
                              onClick={() => remove(e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <ResourcesPanel
                resources={data.resources}
                totals={new Map(data.summary.byResource.map((b) => [b.key, b]))}
                isOrganizer={isOrganizer}
                onChanged={refresh}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function ExpenseForm({
  resources,
  expense,
  onClose,
  onSaved,
}: {
  resources: Resource[];
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // New expenses can only go to active equipment; an existing one may stay on a retired item.
  const choices = resources.filter((r) => r.active || r.id === expense?.resourceId);
  const [resourceId, setResourceId] = useState(expense?.resourceId ?? choices[0]?.id ?? "");
  const [kind, setKind] = useState(expense?.kind ?? "REPAIR");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [cost, setCost] = useState(expense ? String(expense.cost) : "");
  const [date, setDate] = useState(expense?.date ?? today());
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amount = Number(cost);
    if (cost.trim() === "" || !Number.isFinite(amount)) {
      toast.error("Enter the cost.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        resourceId,
        kind,
        description,
        cost: amount,
        incurredOn: date,
        paidBy: paidBy.trim() || null,
      };
      if (expense) await api(`/maintenance/${expense.id}`, { method: "PUT", body });
      else await api("/maintenance", { body });
      toast.success(expense ? "Expense updated" : "Expense recorded");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (choices.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm">
        Add a resource first (for example “Racquet 3” or “Main court”) in the equipment list below,
        then record its expenses.
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-display text-lg font-bold uppercase">
        {expense ? "Edit expense" : "Record expense"}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Resource</Label>
          <select
            className={field}
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          >
            {choices.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({catLabel(r.category)}){r.active ? "" : " — retired"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Type of maintenance</Label>
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            {MAINTENANCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label>What was done</Label>
          <Input
            value={description}
            maxLength={500}
            placeholder="e.g. Strings broken, restrung with BG65"
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Cost</Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <Label>Paid by (optional)</Label>
          <Input
            value={paidBy}
            maxLength={100}
            placeholder="Who paid, so it can be reimbursed"
            onChange={(e) => setPaidBy(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !resourceId || !description.trim()}>
          {expense ? "Save changes" : "Save expense"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Inline form to rename a piece of equipment, change its category or notes. */
function EditResourceRow({
  resource,
  onClose,
  onSaved,
}: {
  resource: Resource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(resource.name);
  const [category, setCategory] = useState(resource.category);
  const [notes, setNotes] = useState(resource.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api(`/resources/${resource.id}`, {
        method: "PUT",
        body: { name, category, notes: notes.trim() || null, active: resource.active },
      });
      toast.success("Equipment updated");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-2 sm:grid-cols-4">
      <Input
        className="sm:col-span-2"
        value={name}
        maxLength={100}
        aria-label="Name"
        onChange={(e) => setName(e.target.value)}
        required
      />
      <select
        className={field}
        value={category}
        aria-label="Category"
        onChange={(e) => setCategory(e.target.value)}
      >
        {RESOURCE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !name.trim()}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <Input
        className="sm:col-span-4"
        placeholder="Notes (optional)"
        value={notes}
        maxLength={500}
        aria-label="Notes"
        onChange={(e) => setNotes(e.target.value)}
      />
    </form>
  );
}

function ResourcesPanel({
  resources,
  totals,
  isOrganizer,
  onChanged,
}: {
  resources: Resource[];
  totals: Map<string, { total: number; count: number }>;
  isOrganizer: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("RACQUET");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/resources", { body: { name, category, notes: notes.trim() || null } });
      setName("");
      setNotes("");
      toast.success("Resource added");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  async function setActive(r: Resource, active: boolean) {
    try {
      await api(`/resources/${r.id}`, {
        method: "PUT",
        body: { name: r.name, category: r.category, notes: r.notes, active },
      });
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  async function remove(r: Resource) {
    if (!confirm(`Delete ${r.name}?`)) return;
    try {
      await api(`/resources/${r.id}`, { method: "DELETE" });
      toast.success("Resource deleted");
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold uppercase">
        <Wrench className="h-5 w-5" /> Shared equipment
      </h2>
      {isOrganizer && (
        <form
          onSubmit={add}
          className="mb-3 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-4"
        >
          <Input
            className="sm:col-span-2"
            placeholder="Name, e.g. Racquet 3 or Main court"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {RESOURCE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
          <Input
            className="sm:col-span-4"
            placeholder="Notes (optional)"
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
          />
        </form>
      )}
      {resources.length === 0 ? (
        <Empty title="No shared equipment yet">
          {isOrganizer
            ? "Add the racquets, shuttles, nets and courts the community shares."
            : "The organizer has not added any equipment yet."}
        </Empty>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {resources.map((r) => {
            const t = totals.get(r.id);
            if (editingId === r.id)
              return (
                <li key={r.id} className="p-3">
                  <EditResourceRow
                    resource={r}
                    onClose={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      onChanged();
                    }}
                  />
                </li>
              );
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${r.active ? "" : "text-muted-foreground line-through"}`}
                  >
                    {r.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {catLabel(r.category)}
                      {r.active ? "" : " · retired"}
                    </span>
                  </p>
                  {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {t ? `${t.count} × · ${formatMoney(t.total)}` : "no expenses"}
                </span>
                {isOrganizer && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit resource"
                      onClick={() => setEditingId(r.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={r.active ? "Retire resource" : "Reactivate resource"}
                      onClick={() => setActive(r, !r.active)}
                    >
                      {r.active ? (
                        <Archive className="h-4 w-4" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete resource"
                      onClick={() => remove(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
