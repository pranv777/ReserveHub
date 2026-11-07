import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlotBoard } from "./SlotBoard";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tick = () => act(() => { vi.advanceTimersByTime(2200); });

describe("SlotBoard", () => {
  it("plays the cancellation story and then loops", () => {
    render(<SlotBoard />);
    expect(screen.getByText("Asha has booked the 14:00 slot.")).toBeInTheDocument();
    expect(screen.getByText("Nobody waiting")).toBeInTheDocument();

    tick();
    expect(screen.getByText("Ben joins the waitlist.")).toBeInTheDocument();
    expect(screen.getByText("Position 1")).toBeInTheDocument();

    tick();
    expect(screen.getByText("Chen joins the waitlist behind Ben.")).toBeInTheDocument();
    expect(screen.getByText("Position 2")).toBeInTheDocument();

    tick();
    expect(screen.getByText("Asha cancels. Ben gets the slot in the same step.")).toBeInTheDocument();
    expect(screen.getByText("Booked from waitlist")).toBeInTheDocument();
    expect(screen.getByText(/you moved off the waitlist and booked Studio B/)).toBeInTheDocument();

    tick(); // holds the final state
    expect(screen.getByText("Booked from waitlist")).toBeInTheDocument();

    tick(); // restarts
    expect(screen.getByText("Asha has booked the 14:00 slot.")).toBeInTheDocument();
  });

  it("shows the final state without animating when reduced motion is requested", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    render(<SlotBoard />);
    expect(screen.getByText("Booked from waitlist")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(screen.getByText("Booked from waitlist")).toBeInTheDocument();
  });

  it("is labelled as an illustration and hidden from screen readers", () => {
    const { container } = render(<SlotBoard />);
    expect(screen.getByText("Illustration with example names.")).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
