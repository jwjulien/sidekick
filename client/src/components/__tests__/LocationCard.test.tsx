import { render, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import LocationCard from "../storage/LocationCard";

describe("LocationCard NFC button", () => {
  const mockLocation = {
    id: "loc-123",
    name: "Bin A-4",
    quantity: 10,
    last_counted: "2026-08-28T12:00:00Z"
  };

  it("does not render NFC button when onWriteNfc prop is omitted", () => {
    const { queryByTitle } = render(() => (
      <LocationCard location={mockLocation} />
    ));

    expect(queryByTitle("Write NFC Tag")).toBeNull();
  });

  it("renders NFC button and calls onWriteNfc when clicked", () => {
    const handleWriteNfc = vi.fn();
    const { getByTitle } = render(() => (
      <LocationCard
        location={mockLocation}
        onWriteNfc={handleWriteNfc}
      />
    ));

    const nfcButton = getByTitle("Write NFC Tag");
    expect(nfcButton).not.toBeNull();

    fireEvent.click(nfcButton);
    expect(handleWriteNfc).toHaveBeenCalledTimes(1);
    expect(handleWriteNfc).toHaveBeenCalledWith(mockLocation);
  });
});
