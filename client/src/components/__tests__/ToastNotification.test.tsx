import { render, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import { ToastNotification } from "../toast/ToastNotification";

describe("ToastNotification Component", () => {
  it("renders toast title and message text", () => {
    const { getByText } = render(() => (
      <ToastNotification
        toastId="toast-1"
        title="Operation Successful"
        message="Your changes have been saved."
        variant="success"
      />
    ));

    expect(getByText("Operation Successful")).not.toBeNull();
    expect(getByText("Your changes have been saved.")).not.toBeNull();
  });

  it("applies correct variant styling and borders for error variant", () => {
    const { container } = render(() => (
      <ToastNotification
        toastId="toast-2"
        message="An unexpected error occurred"
        variant="error"
      />
    ));

    const alert = container.querySelector("[role='alert']");
    expect(alert).not.toBeNull();
    expect(alert?.className).toContain("toast-variant-error");
  });

  it("applies correct variant styling for warning variant", () => {
    const { container } = render(() => (
      <ToastNotification
        toastId="toast-3"
        message="Warning: low stock"
        variant="warning"
      />
    ));

    const alert = container.querySelector("[role='alert']");
    expect(alert?.className).toContain("toast-variant-warning");
  });

  it("renders primary and secondary action buttons and handles clicks", async () => {
    const primaryClick = vi.fn();
    const secondaryClick = vi.fn();

    const { getByText } = render(() => (
      <ToastNotification
        toastId="toast-4"
        message="Item deleted"
        variant="info"
        actions={[
          { title: "Undo", variant: "primary", onClick: primaryClick },
          { title: "Dismiss", variant: "secondary", onClick: secondaryClick }
        ]}
      />
    ));

    const undoBtn = getByText("Undo");
    const dismissBtn = getByText("Dismiss");

    expect(undoBtn).not.toBeNull();
    expect(dismissBtn).not.toBeNull();

    await fireEvent.click(undoBtn);
    expect(primaryClick).toHaveBeenCalledWith("toast-4");
  });

  it("calls onDismiss when close button is clicked", async () => {
    const onDismiss = vi.fn();

    const { getByLabelText } = render(() => (
      <ToastNotification
        toastId="toast-5"
        message="Notification test"
        onDismiss={onDismiss}
      />
    ));

    const closeBtn = getByLabelText("Dismiss toast");
    await fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledWith("toast-5");
  });
});
