import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Pagination } from "../../components/Pagination";
import { QueryState } from "../../components/QueryState";
import { StatusBadge } from "../../components/StatusBadge";
import { errorMessage } from "../../lib/api/client";
import { createResource, createSlot, deactivateResource, listResources, updateResource } from "../../lib/api/endpoints";
import type { Resource } from "../../lib/api/types";
import { localInputToIso } from "../../lib/format";

const PAGE_SIZE = 10;

const resourceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "At most 120 characters"),
  description: z.string().max(2000, "At most 2000 characters"),
  location: z.string().max(120, "At most 120 characters"),
  category: z.string().max(60, "At most 60 characters"),
  capacity: z.coerce.number().int("Whole number").min(1, "At least 1").max(10000),
});
type ResourceForm = z.input<typeof resourceSchema>;

const EMPTY_RESOURCE: ResourceForm = { name: "", description: "", location: "", category: "", capacity: 1 };

const slotSchema = z
  .object({ start: z.string().min(1, "Start is required"), end: z.string().min(1, "End is required") })
  .refine((v) => !v.start || !v.end || new Date(v.end) > new Date(v.start), { path: ["end"], message: "End must be after start" })
  .refine((v) => !v.start || new Date(v.start) > new Date(), { path: ["start"], message: "Start must be in the future" });
type SlotForm = z.infer<typeof slotSchema>;

export function AdminResourcesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [slotFor, setSlotFor] = useState<Resource | null>(null);
  const [deactivating, setDeactivating] = useState<Resource | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const q = useQuery({ queryKey: ["admin-resources", page], queryFn: () => listResources({ page, page_size: PAGE_SIZE, include_inactive: true }) });
  const refresh = () => Promise.all(["admin-resources", "slots", "slot"].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  const rf = useForm<ResourceForm>({
    resolver: zodResolver(resourceSchema),
    defaultValues: EMPTY_RESOURCE,
  });
  const sf = useForm<SlotForm>({ resolver: zodResolver(slotSchema), defaultValues: { start: "", end: "" } });

  const save = useMutation({
    mutationFn: (v: z.output<typeof resourceSchema>) => (editing ? updateResource(editing.id, v) : createResource(v)),
    onSuccess: async () => {
      setNotice({ kind: "ok", text: editing ? "Resource updated." : "Resource created." });
      setEditing(null);
      rf.reset(EMPTY_RESOURCE);
      await refresh();
    },
    onError: (e) => setNotice({ kind: "error", text: errorMessage(e) }),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => deactivateResource(id),
    onSuccess: async () => { setNotice({ kind: "ok", text: "Resource deactivated. History was kept." }); setDeactivating(null); await refresh(); },
    onError: (e) => { setNotice({ kind: "error", text: errorMessage(e) }); setDeactivating(null); },
  });
  const addSlot = useMutation({
    mutationFn: (v: SlotForm) => createSlot(slotFor!.id, { start_at: localInputToIso(v.start), end_at: localInputToIso(v.end) }),
    onSuccess: async () => { setNotice({ kind: "ok", text: "Slot created." }); sf.reset(); await refresh(); },
    onError: (e) => setNotice({ kind: "error", text: errorMessage(e) }),
  });

  const startEdit = (r: Resource) => {
    setEditing(r);
    rf.reset({ name: r.name, description: r.description, location: r.location, category: r.category, capacity: r.capacity });
  };

  return (
    <section>
      <h1 className="text-2xl font-bold">Manage resources</h1>
      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded p-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
          {notice.text}
        </p>
      )}

      <form className="card mt-4 grid gap-3 sm:grid-cols-2" noValidate
        onSubmit={rf.handleSubmit((v) => save.mutate(resourceSchema.parse(v)))} aria-label="Resource form">
        <h2 className="text-lg font-semibold sm:col-span-2">{editing ? `Edit ${editing.name}` : "New resource"}</h2>
        <div>
          <label className="label" htmlFor="r-name">Name</label>
          <input id="r-name" className="input" {...rf.register("name")} />
          {rf.formState.errors.name && <p className="field-error">{rf.formState.errors.name.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="r-location">Location</label>
          <input id="r-location" className="input" {...rf.register("location")} />
          {rf.formState.errors.location && <p className="field-error">{rf.formState.errors.location.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="r-category">Category</label>
          <input id="r-category" className="input" {...rf.register("category")} />
        </div>
        <div>
          <label className="label" htmlFor="r-capacity">Capacity</label>
          <input id="r-capacity" type="number" className="input" {...rf.register("capacity")} />
          {rf.formState.errors.capacity && <p className="field-error">{rf.formState.errors.capacity.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="r-desc">Description</label>
          <textarea id="r-desc" rows={2} className="input" {...rf.register("description")} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Create resource"}
          </button>
          {editing && <button type="button" className="btn" onClick={() => { setEditing(null); rf.reset(EMPTY_RESOURCE); }}>Cancel edit</button>}
        </div>
      </form>

      <div className="mt-6">
        <QueryState isLoading={q.isLoading} error={q.error} isEmpty={q.data?.items.length === 0}
          emptyMessage="No resources yet. Create the first one above." onRetry={() => void q.refetch()}>
          <ul className="space-y-2" data-testid="admin-resource-list">
            {q.data?.items.map((r) => (
              <li key={r.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.name} <StatusBadge status={r.is_active ? "available" : "inactive"} /></p>
                    <p className="text-sm text-slate-600">{[r.location, r.category].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn" onClick={() => startEdit(r)} aria-label={`Edit ${r.name}`}>Edit</button>
                    {r.is_active && (
                      <>
                        <button type="button" className="btn" onClick={() => { setSlotFor(r); sf.reset(); }} aria-label={`Add slot to ${r.name}`}>Add slot</button>
                        <button type="button" className="btn" onClick={() => setDeactivating(r)} aria-label={`Deactivate ${r.name}`}>Deactivate</button>
                      </>
                    )}
                  </div>
                </div>
                {slotFor?.id === r.id && (
                  <form className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-3" noValidate
                    onSubmit={sf.handleSubmit((v) => addSlot.mutate(v))} aria-label={`New slot for ${r.name}`}>
                    <div>
                      <label className="label" htmlFor="s-start">Start</label>
                      <input id="s-start" type="datetime-local" className="input" {...sf.register("start")} />
                      {sf.formState.errors.start && <p className="field-error">{sf.formState.errors.start.message}</p>}
                    </div>
                    <div>
                      <label className="label" htmlFor="s-end">End</label>
                      <input id="s-end" type="datetime-local" className="input" {...sf.register("end")} />
                      {sf.formState.errors.end && <p className="field-error">{sf.formState.errors.end.message}</p>}
                    </div>
                    <div className="flex items-end gap-2">
                      <button type="submit" className="btn btn-primary" disabled={addSlot.isPending}>{addSlot.isPending ? "Creating…" : "Create slot"}</button>
                      <button type="button" className="btn" onClick={() => setSlotFor(null)}>Close</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {q.data && <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onPage={setPage} />}
        </QueryState>
      </div>

      {deactivating && (
        <ConfirmDialog title="Deactivate this resource?" confirmLabel="Deactivate" busy={deactivate.isPending}
          onConfirm={() => deactivate.mutate(deactivating.id)} onCancel={() => setDeactivating(null)}>
          {deactivating.name} will no longer be bookable. Existing bookings and history are kept.
        </ConfirmDialog>
      )}
    </section>
  );
}
