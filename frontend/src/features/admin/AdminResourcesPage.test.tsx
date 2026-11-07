import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/client";
import type { Resource } from "../../lib/api/types";
import { renderAt } from "../../test/utils";
import { AdminResourcesPage } from "./AdminResourcesPage";

const listResources = vi.fn();
const createResource = vi.fn();
const updateResource = vi.fn();
const deactivateResource = vi.fn();
const createSlot = vi.fn();
vi.mock("../../lib/api/endpoints", () => ({
  listResources: (...a: unknown[]) => listResources(...a),
  createResource: (...a: unknown[]) => createResource(...a),
  updateResource: (...a: unknown[]) => updateResource(...a),
  deactivateResource: (...a: unknown[]) => deactivateResource(...a),
  createSlot: (...a: unknown[]) => createSlot(...a),
}));

const resource = (over: Partial<Resource> = {}): Resource => ({
  id: "r1", name: "Room A", description: "", location: "Floor 2", category: "room", capacity: 4,
  is_active: true, created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z", ...over,
});
const page = (items: Resource[]) => ({ items, total: items.length, page: 1, page_size: 10 });

beforeEach(() => {
  [listResources, createResource, updateResource, deactivateResource, createSlot].forEach((m) => m.mockReset());
  listResources.mockResolvedValue(page([resource()]));
});

describe("AdminResourcesPage resources", () => {
  it("validates the form before calling the API", async () => {
    renderAt(<AdminResourcesPage />);
    await userEvent.click(screen.getByRole("button", { name: "Create resource" }));
    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(createResource).not.toHaveBeenCalled();
  });

  it("creates a resource", async () => {
    createResource.mockResolvedValue(resource({ id: "r2", name: "Court 1" }));
    renderAt(<AdminResourcesPage />);
    await userEvent.type(screen.getByLabelText("Name"), "Court 1");
    await userEvent.type(screen.getByLabelText("Location"), "Gym");
    await userEvent.type(screen.getByLabelText("Category"), "sport");
    await userEvent.click(screen.getByRole("button", { name: "Create resource" }));
    await waitFor(() =>
      expect(createResource).toHaveBeenCalledWith({
        name: "Court 1", description: "", location: "Gym", category: "sport", capacity: 1,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Resource created.");
  });

  it("shows the API error when creating fails", async () => {
    createResource.mockRejectedValue(new ApiError(409, "conflict", "A resource with that name already exists."));
    renderAt(<AdminResourcesPage />);
    await userEvent.type(screen.getByLabelText("Name"), "Room A");
    await userEvent.click(screen.getByRole("button", { name: "Create resource" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A resource with that name already exists.");
  });

  it("edits a resource", async () => {
    updateResource.mockResolvedValue(resource({ name: "Room AA" }));
    renderAt(<AdminResourcesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Room A" }));
    expect(screen.getByRole("heading", { name: "Edit Room A" })).toBeInTheDocument();
    const name = screen.getByLabelText("Name");
    expect(name).toHaveValue("Room A");
    await userEvent.clear(name);
    await userEvent.type(name, "Room AA");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateResource).toHaveBeenCalledWith("r1", expect.objectContaining({ name: "Room AA", capacity: 4 })),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Resource updated.");
  });

  it("can cancel an edit", async () => {
    renderAt(<AdminResourcesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Room A" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));
    expect(screen.getByRole("heading", { name: "New resource" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("deactivates only after confirmation", async () => {
    deactivateResource.mockResolvedValue(resource({ is_active: false }));
    renderAt(<AdminResourcesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Deactivate Room A" }));
    expect(deactivateResource).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Deactivate this resource?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(deactivateResource).toHaveBeenCalledWith("r1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Resource deactivated. History was kept.");
  });

  it("does not offer slots or deactivation for an inactive resource", async () => {
    listResources.mockResolvedValue(page([resource({ id: "r2", name: "Old Room", is_active: false })]));
    renderAt(<AdminResourcesPage />);
    expect(await screen.findByText("inactive")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Old Room" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate Old Room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add slot to Old Room" })).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    listResources.mockResolvedValue(page([]));
    renderAt(<AdminResourcesPage />);
    expect(await screen.findByText("No resources yet. Create the first one above.")).toBeInTheDocument();
  });
});

describe("AdminResourcesPage slots", () => {
  const openSlotForm = async () => {
    renderAt(<AdminResourcesPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Add slot to Room A" }));
    return screen.getByRole("form", { name: "New slot for Room A" });
  };

  it("requires a start and an end", async () => {
    const form = await openSlotForm();
    await userEvent.click(within(form).getByRole("button", { name: "Create slot" }));
    expect(await screen.findByText("Start is required")).toBeInTheDocument();
    expect(screen.getByText("End is required")).toBeInTheDocument();
    expect(createSlot).not.toHaveBeenCalled();
  });

  it("rejects an end before the start", async () => {
    const form = await openSlotForm();
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2999-01-01T10:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2999-01-01T09:00" } });
    await userEvent.click(within(form).getByRole("button", { name: "Create slot" }));
    expect(await screen.findByText("End must be after start")).toBeInTheDocument();
    expect(createSlot).not.toHaveBeenCalled();
  });

  it("rejects a start in the past", async () => {
    const form = await openSlotForm();
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2000-01-01T10:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2000-01-01T11:00" } });
    await userEvent.click(within(form).getByRole("button", { name: "Create slot" }));
    expect(await screen.findByText("Start must be in the future")).toBeInTheDocument();
  });

  it("creates a slot with UTC times", async () => {
    createSlot.mockResolvedValue({ id: "s1" });
    const form = await openSlotForm();
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2999-01-01T10:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2999-01-01T11:00" } });
    await userEvent.click(within(form).getByRole("button", { name: "Create slot" }));
    await waitFor(() =>
      expect(createSlot).toHaveBeenCalledWith("r1", {
        start_at: new Date("2999-01-01T10:00").toISOString(),
        end_at: new Date("2999-01-01T11:00").toISOString(),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Slot created.");
  });

  it("can close the slot form", async () => {
    const form = await openSlotForm();
    await userEvent.click(within(form).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("form", { name: "New slot for Room A" })).not.toBeInTheDocument();
  });
});
