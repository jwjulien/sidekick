import { render, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import UniversalLocationSelector from "../storage/UniversalLocationSelector";
import { parseDeepLink } from "../../utils/deepLink";

describe("UniversalLocationSelector NFC Scan handling", () => {
  const mockLocations = [
    { id: "root-1", name: "Main Warehouse", parent_id: null },
    { id: "shelf-101", name: "Shelf A1", parent_id: "root-1" },
    { id: "bin-202", name: "Bin 202", parent_id: "shelf-101" },
    { id: "root-2", name: "Secondary Storage", parent_id: null },
  ];

  it("updates selection, expands miller columns path, and calls onSelectLocation when an NFC tag is scanned", async () => {
    let selectedLoc: any = null;
    const handleSelect = vi.fn((loc) => {
      selectedLoc = loc;
    });

    const { container } = render(() => (
      <UniversalLocationSelector
        locations={mockLocations}
        onSelectLocation={handleSelect}
      />
    ));

    // Initially "Main Warehouse" is in root column
    expect(container).toHaveTextContent("Main Warehouse");

    // Simulate scanning NFC tag for "Bin 202" (fuse://location/bin-202)
    const parsed = parseDeepLink("fuse://location/bin-202");
    const nfcEvent = new CustomEvent("sidekick:nfc-scanned", {
      detail: parsed,
      cancelable: true,
    });

    window.dispatchEvent(nfcEvent);

    // Verify onSelectLocation was called with Bin 202
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "bin-202", name: "Bin 202" }));
    expect(selectedLoc?.id).toBe("bin-202");

    // Verify event default was prevented
    expect(nfcEvent.defaultPrevented).toBe(true);

    // Verify Miller columns contain ancestor path (Main Warehouse -> Shelf A1 -> Bin 202)
    expect(container).toHaveTextContent("Shelf A1");
    expect(container).toHaveTextContent("Bin 202");
  });

  it("clears search mode and switches to Miller columns mode when NFC tag is scanned", async () => {
    const handleSelect = vi.fn();

    const { container } = render(() => (
      <UniversalLocationSelector
        locations={mockLocations}
        onSelectLocation={handleSelect}
      />
    ));

    // Type into search box to activate Search Mode
    const searchInput = container.querySelector("input[type='text']") as HTMLInputElement;
    expect(searchInput).not.toBeNull();
    fireEvent.input(searchInput, { target: { value: "Warehouse" } });

    expect(container).toHaveTextContent('Search Results for "Warehouse"');

    // Dispatch NFC scan event
    const parsed = parseDeepLink("fuse://location/bin-202");
    const nfcEvent = new CustomEvent("sidekick:nfc-scanned", {
      detail: parsed,
      cancelable: true,
    });
    window.dispatchEvent(nfcEvent);

    // Search term should be cleared, switching view back to Miller columns
    expect(container).not.toHaveTextContent('Search Results for "Warehouse"');
    expect(container).toHaveTextContent("Bin 202");
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "bin-202" }));
  });
});
