import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  DUE_SORT_LABEL,
  filterDues,
  sortDues,
  splitEqually,
  type Balance,
  type DueSort,
  type DueStatus,
} from "@/lib/engine/dues";
import { formatMoney } from "@/lib/engine/maintenance";
import { Empty } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Due = {
  id: string;
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: number;
  reason: string | null;
  date: string;
  paid: boolean;
  paidOn: string | null;
};
type DuesData = {
  dues: Due[];
  balances: Balance[];
  totals: { outstanding: number; settled: number; unpaid: number; paid: number };
};
type PlayerOption = { id: string; name: string };

const field = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);

export function DuesPanel({ isOrganizer }: { isOrganizer: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dues"],
    queryFn: () => api<DuesData>("/dues"),
  });
  const { data: playerList = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => api<PlayerOption[]>("/players"),
  });
  const players = useMemo(
    () => [...playerList].sort((a, b) => a.name.localeCompare(b.name)),
    [playerList],
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ["dues"] });

  const [status, setStatus] = useState<DueStatus>("unpaid");
  const [playerId, setPlayerId] = useState("");
  const [role, setRole] = useState<"any" | "debtor" | "creditor">("any");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DueSort>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const shown = useMemo(
    () => sortDues(filterDues(data?.dues ?? [], { status, playerId, role, search }), sort),
    [data, status, playerId, role, search, sort],
  );

  if (error) return <p className="text-destructive">{(error as Error).message}</p>;
  if (isLoading || !data) return <Skeleton className="h-64" />;

  const save = async (d: Due, patch: Partial<Due>) => {
    const next = { ...d, ...patch };
    try {
      await api(`/dues/${d.id}`, {
        method: "PUT",
        body: {
          debtorId: next.debtorId,
          creditorId: next.creditorId,
          amount: next.amount,
          reason: next.reason,
          date: next.date,
          paid: next.paid,
        },
      });
      refresh();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };
  async function remove(d: Due) {
    if (!confirm(`Delete ${d.debtorName} → ${d.creditorName} ${formatMoney(d.amount)}?`)) return;
    try {
      await api(`/dues/${d.id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Still to be paid" value={formatMoney(data.totals.outstanding)} />
        <Stat label="Already paid" value={formatMoney(data.totals.settled)} />
        <Stat label="Unpaid entries" value={String(data.totals.unpaid)} />
      </div>

      {data.balances.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 font-display text-lg font-bold uppercase">Who owes what</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Unpaid amounts only. Positive means the player is net owed money.
          </p>
          <ul className="divide-y text-sm">
            {data.balances.map((b) => (
              <li key={b.playerId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                  onClick={() => {
                    setPlayerId(b.playerId);
                    setRole("any");
                    setStatus("unpaid");
                  }}
                >
                  {b.name}
                </button>
                <span className="text-muted-foreground">owes {formatMoney(b.owes)}</span>
                <span className="text-muted-foreground">is owed {formatMoney(b.owed)}</span>
                <span
                  className={`w-28 text-right font-semibold tabular-nums ${b.net > 0 ? "text-primary" : b.net < 0 ? "text-destructive" : ""}`}
                >
                  {b.net > 0 ? "+" : ""}
                  {formatMoney(b.net)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOrganizer &&
        (adding ? (
          <AddDues
            players={players}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              refresh();
            }}
          />
        ) : (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add dues
          </Button>
        ))}

      <section>
        <div className="mb-3 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs">Status</Label>
            <div className="flex gap-1">
              {(["unpaid", "paid", "all"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  onClick={() => setStatus(s)}
                >
                  {s === "all" ? "All" : s === "paid" ? "Paid" : "Unpaid"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Player</Label>
            <select
              className={field}
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">Everyone</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">As</Label>
            <select
              className={field}
              value={role}
              disabled={!playerId}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="any">Owes or is owed</option>
              <option value="debtor">Owes money</option>
              <option value="creditor">Is owed money</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Search</Label>
            <Input
              value={search}
              placeholder="Name or note"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Sort by</Label>
            <select
              className={field}
              value={sort}
              onChange={(e) => setSort(e.target.value as DueSort)}
            >
              {(Object.keys(DUE_SORT_LABEL) as DueSort[]).map((k) => (
                <option key={k} value={k}>
                  {DUE_SORT_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {shown.length === 0 ? (
          <Empty title={data.dues.length === 0 ? "Nothing to split yet" : "No matching entries"}>
            {data.dues.length === 0
              ? isOrganizer
                ? "Use “Add dues” to record who owes whom."
                : "The organizer has not recorded any dues yet."
              : "Change the filters to see more."}
          </Empty>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {shown.map((d) =>
              editingId === d.id ? (
                <li key={d.id} className="p-3">
                  <EditDue
                    due={d}
                    players={players}
                    onCancel={() => setEditingId(null)}
                    onSave={async (patch) => {
                      if (await save(d, patch)) setEditingId(null);
                    }}
                  />
                </li>
              ) : (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {d.debtorName} <span className="text-muted-foreground">owes</span>{" "}
                      {d.creditorName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.date}
                      {d.reason ? ` · ${d.reason}` : ""}
                      {d.paid && d.paidOn ? ` · paid on ${d.paidOn}` : ""}
                    </p>
                  </div>
                  <span className="font-display text-lg font-bold tabular-nums">
                    {formatMoney(d.amount)}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${d.paid ? "bg-primary text-primary-foreground" : "bg-destructive/15 text-destructive"}`}
                  >
                    {d.paid ? "Paid" : "Unpaid"}
                  </span>
                  {isOrganizer && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={d.paid ? "Mark as unpaid" : "Mark as paid"}
                        onClick={() => save(d, { paid: !d.paid })}
                      >
                        {d.paid ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit"
                        onClick={() => setEditingId(d.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete"
                        onClick={() => remove(d)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {shown.length} of {data.dues.length}. Splits are entered by hand and are not tied
          to the recorded expenses.
        </p>
      </section>
    </div>
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

function PlayerSelect({
  players,
  value,
  onChange,
  placeholder,
  exclude,
  label,
}: {
  players: PlayerOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  exclude?: string;
  label: string;
}) {
  return (
    <select
      className={field}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {players
        .filter((p) => p.id !== exclude)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );
}

/** Add one due, or split a total equally between several players who owe the same person. */
function AddDues({
  players,
  onClose,
  onSaved,
}: {
  players: PlayerOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"single" | "split">("single");
  const [creditorId, setCreditorId] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(today());
  const [debtorId, setDebtorId] = useState("");
  const [amount, setAmount] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [includePayer, setIncludePayer] = useState(true);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const total = Number(amount);
  const splitChoices = chosen.filter((id) => id !== creditorId);
  // Suggested equal shares; the organizer can still tweak any single amount.
  const suggested = useMemo(() => {
    if (mode !== "split" || splitChoices.length === 0 || !(total > 0)) return null;
    try {
      return splitEqually(total, splitChoices.length, includePayer);
    } catch {
      return null;
    }
  }, [mode, splitChoices.length, total, includePayer]);
  const shareOf = (id: string, i: number) => edited[id] ?? String(suggested?.[i] ?? "");

  function resetEdits() {
    setEdited({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const entries =
      mode === "single"
        ? [{ debtorId, amount: total }]
        : splitChoices.map((id, i) => ({ debtorId: id, amount: Number(shareOf(id, i)) }));
    if (!creditorId) return void toast.error("Choose who is owed the money.");
    if (entries.some((x) => !x.debtorId || !Number.isFinite(x.amount) || x.amount <= 0))
      return void toast.error("Pick the players and enter amounts above zero.");
    setBusy(true);
    try {
      await api("/dues", { body: { creditorId, entries, reason: reason.trim() || null, date } });
      toast.success(entries.length > 1 ? `${entries.length} dues added` : "Due added");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase">Add dues</h2>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "single" ? "default" : "outline"}
            onClick={() => setMode("single")}
          >
            One player
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "split" ? "default" : "outline"}
            onClick={() => setMode("split")}
          >
            Split equally
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Owed to (who paid)</Label>
          <PlayerSelect
            label="Owed to"
            players={players}
            value={creditorId}
            onChange={(v) => {
              setCreditorId(v);
              resetEdits();
            }}
            placeholder="Choose player"
          />
        </div>
        {mode === "single" ? (
          <div>
            <Label>Who owes</Label>
            <PlayerSelect
              label="Who owes"
              players={players}
              value={debtorId}
              onChange={setDebtorId}
              placeholder="Choose player"
              exclude={creditorId}
            />
          </div>
        ) : (
          <div />
        )}
        <div>
          <Label>{mode === "single" ? "Amount" : "Total amount to split"}</Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              resetEdits();
            }}
            required
          />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <Label>Note (optional)</Label>
          <Input
            value={reason}
            maxLength={200}
            placeholder="e.g. New net, shuttle tube, court booking"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>

      {mode === "split" && (
        <div className="space-y-2">
          <Label>Players sharing the cost</Label>
          <div className="flex flex-wrap gap-1.5">
            {players
              .filter((p) => p.id !== creditorId)
              .map((p) => {
                const on = chosen.includes(p.id);
                return (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() => {
                      setChosen((c) => (on ? c.filter((x) => x !== p.id) : [...c, p.id]));
                      resetEdits();
                    }}
                  >
                    {p.name}
                  </Button>
                );
              })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePayer}
              onChange={(e) => {
                setIncludePayer(e.target.checked);
                resetEdits();
              }}
            />
            Include the person who paid in the split
          </label>
          {splitChoices.length > 0 && suggested && (
            <ul className="divide-y rounded-lg border text-sm">
              {splitChoices.map((id, i) => (
                <li key={id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="flex-1">{players.find((p) => p.id === id)?.name}</span>
                  <Input
                    className="h-8 w-28"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    aria-label="Amount owed"
                    value={shareOf(id, i)}
                    onChange={(e) => setEdited({ ...edited, [id]: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Each amount can be adjusted before saving. One entry is created per player.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditDue({
  due,
  players,
  onSave,
  onCancel,
}: {
  due: Due;
  players: PlayerOption[];
  onSave: (patch: Partial<Due>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [debtorId, setDebtorId] = useState(due.debtorId);
  const [creditorId, setCreditorId] = useState(due.creditorId);
  const [amount, setAmount] = useState(String(due.amount));
  const [reason, setReason] = useState(due.reason ?? "");
  const [date, setDate] = useState(due.date);
  const [paid, setPaid] = useState(due.paid);
  const valid = debtorId && creditorId && debtorId !== creditorId && Number(amount) > 0;
  return (
    <form
      className="grid gap-2 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid)
          void onSave({
            debtorId,
            creditorId,
            amount: Number(amount),
            reason: reason.trim() || null,
            date,
            paid,
          });
      }}
    >
      <PlayerSelect
        label="Who owes"
        players={players}
        value={debtorId}
        onChange={setDebtorId}
        placeholder="Who owes"
        exclude={creditorId}
      />
      <PlayerSelect
        label="Owed to"
        players={players}
        value={creditorId}
        onChange={setCreditorId}
        placeholder="Owed to"
        exclude={debtorId}
      />
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        aria-label="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input
        className="sm:col-span-2"
        placeholder="Note (optional)"
        aria-label="Note"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Paid
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={!valid}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
