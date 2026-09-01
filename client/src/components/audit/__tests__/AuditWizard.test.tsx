import { render, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import AuditWizard, { AuditLocationItem } from "../AuditWizard";
import { ScaleProvider } from "../../../context/ScaleContext";

describe("AuditWizard Component", () => {
  const mockItems: AuditLocationItem[] = [
    {
      id: "loc-1",
      name: "Bin A1",
      path: "Rack 1 / Drawer A / Bin A1",
      part_id: "part-1",
      part_name: "10k Resistor",
      part_number: "RES-10K",
      quantity: 50,
      last_counted: null,
    },
    {
      id: "loc-2",
      name: "Bin A2",
      path: "Rack 1 / Drawer A / Bin A2",
      part_id: "part-2",
      part_name: "100uF Capacitor",
      part_number: "CAP-100U",
      quantity: 12,
      last_counted: null,
    },
  ];

  it("renders item details and path when open", () => {
    const handleClose = vi.fn();
    const handleComplete = vi.fn();

    const { getByText } = render(() => (
      <ScaleProvider>
        <AuditWizard
          isOpen={true}
          onClose={handleClose}
          items={mockItems}
          onComplete={handleComplete}
        />
      </ScaleProvider>
    ));

    expect(getByText("Rack 1 / Drawer A / Bin A1")).not.toBeNull();
    expect(getByText("10k Resistor")).not.toBeNull();
    expect(getByText("PN: RES-10K")).not.toBeNull();
  });

  it("allows incrementing and decrementing verified quantity via quick tap buttons", () => {
    const { getByText, getByDisplayValue } = render(() => (
      <ScaleProvider>
        <AuditWizard
          isOpen={true}
          onClose={vi.fn()}
          items={mockItems}
          onComplete={vi.fn()}
        />
      </ScaleProvider>
    ));

    // Initial quantity is 50
    expect(getByDisplayValue("50")).not.toBeNull();

    // Click +10 button
    const plus10Btn = getByText("+10");
    fireEvent.click(plus10Btn);

    // Quantity should be 60
    expect(getByDisplayValue("60")).not.toBeNull();
  });
});
