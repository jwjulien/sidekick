import { render, fireEvent, waitFor } from "@solidjs/testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Storage from "../Storage";
import { ViewStateProvider } from "../../context/ViewStateContext";
import { ConfirmProvider } from "../../contexts/ConfirmContext";
import { Router, Route } from "@solidjs/router";
import * as useAuthModule from "../../hooks/useAuth";

const mockLocations = [
  { id: "loc-1", name: "Location 1", parent_id: null, index: 0 },
  { id: "loc-2", name: "Location 2", parent_id: null, index: 1 },
  { id: "sub-1", name: "Sub Location 1", parent_id: "loc-1", index: 0 },
];

vi.mock("../../hooks/useAuth", () => ({
  apiFetch: vi.fn(),
}));

describe("Storage page deep link reset behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (useAuthModule.apiFetch as any).mockImplementation((url: string) => {
      if (url === "/locations?flat=true") {
        return Promise.resolve(mockLocations);
      }
      return Promise.resolve([]);
    });
  });

  it("strips 'location' and 'loc' query params from URL when resolving deep link", async () => {
    // Set initial window location with deep link param
    window.history.replaceState({}, "", "/storage?location=loc-1");

    render(() => (
      <ViewStateProvider>
        <ConfirmProvider>
          <Router>
            <Route path="/storage" component={Storage} />
          </Router>
        </ConfirmProvider>
      </ViewStateProvider>
    ));

    await waitFor(() => {
      expect(useAuthModule.apiFetch).toHaveBeenCalledWith("/locations?flat=true");
    });

    await waitFor(() => {
      const currentUrl = new URL(window.location.href);
      expect(currentUrl.searchParams.get("location")).toBeNull();
      expect(currentUrl.searchParams.get("loc")).toBeNull();
      expect(currentUrl.searchParams.get("locPath")).toBe("loc-1");
    });
  });

  it("retains the newly selected location path after location edit/reload without resetting to original deep link location", async () => {
    window.history.replaceState({}, "", "/storage?location=loc-1");

    const { getByText, findByText } = render(() => (
      <ViewStateProvider>
        <ConfirmProvider>
          <Router>
            <Route path="/storage" component={Storage} />
          </Router>
        </ConfirmProvider>
      </ViewStateProvider>
    ));

    await findByText("Location 1");
    await findByText("Location 2");

    // Click on "Location 2" to navigate away from deep linked Location 1
    const loc2Node = getByText("Location 2");
    fireEvent.click(loc2Node);

    await waitFor(() => {
      const currentUrl = new URL(window.location.href);
      expect(currentUrl.searchParams.get("locPath")).toBe("loc-2");
    });

    // Simulate location reload (as triggered when saving an edited location)
    (useAuthModule.apiFetch as any).mockResolvedValueOnce([
      { id: "loc-1", name: "Location 1", parent_id: null, index: 0 },
      { id: "loc-2", name: "Location 2 Updated", parent_id: null, index: 1 },
      { id: "sub-1", name: "Sub Location 1", parent_id: "loc-1", index: 0 },
    ]);

    // Dispatch popstate or custom event that triggers component effect
    window.dispatchEvent(new Event("popstate"));

    await waitFor(() => {
      const currentUrl = new URL(window.location.href);
      expect(currentUrl.searchParams.get("locPath")).toBe("loc-2");
      expect(currentUrl.searchParams.get("location")).toBeNull();
    });
  });
});
