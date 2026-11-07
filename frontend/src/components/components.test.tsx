import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { Pagination } from "./Pagination";
import { StatusBadge } from "./StatusBadge";

describe("Pagination", () => {
  it("shows the summary and disables Previous on the first page", () => {
    render(<Pagination page={1} pageSize={10} total={25} onPage={vi.fn()} />);
    expect(screen.getByText("Page 1 of 3 · 25 total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("asks for the neighbouring page", async () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pageSize={10} total={25} onPage={onPage} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPage).toHaveBeenNthCalledWith(1, 3);
    expect(onPage).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables Next on the last page and treats zero results as one page", () => {
    const { rerender } = render(<Pagination page={3} pageSize={10} total={25} onPage={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    rerender(<Pagination page={1} pageSize={10} total={0} onPage={vi.fn()} />);
    expect(screen.getByText("Page 1 of 1 · 0 total")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("StatusBadge", () => {
  it.each([
    ["confirmed", "bg-green-100"],
    ["waiting", "bg-amber-100"],
    ["cancelled", "bg-slate-200"],
    ["inactive", "bg-red-100"],
    ["something-else", "bg-slate-100"],
  ])("styles %s", (status, cls) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toHaveClass(cls);
  });
});

describe("ConfirmDialog", () => {
  const setup = (props: Partial<ComponentProps<typeof ConfirmDialog>> = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog title="Delete it?" confirmLabel="Yes, delete" onConfirm={onConfirm} onCancel={onCancel} {...props}>
        This cannot be undone.
      </ConfirmDialog>,
    );
    return { onConfirm, onCancel };
  };

  it("renders an accessible dialog and focuses the safe option", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Delete it?" })).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus();
  });

  it("confirms and cancels", async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const { onCancel } = setup();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while busy", () => {
    setup({ busy: true });
    expect(screen.getByRole("button", { name: "Keep it" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
  });
});
