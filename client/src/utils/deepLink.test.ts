import { describe, it, expect } from "vitest";
import { parseDeepLink } from "./deepLink";

describe("parseDeepLink", () => {
  it("returns null for non-fuse URLs", () => {
    expect(parseDeepLink("https://example.com")).toBeNull();
    expect(parseDeepLink("http://localhost:5173")).toBeNull();
    expect(parseDeepLink("")).toBeNull();
  });

  it("parses fuse://location/{id} links", () => {
    const result = parseDeepLink("fuse://location/018f8a32-1234-7000-8000-000000000001");
    expect(result).not.toBeNull();
    expect(result?.action).toBe("location");
    expect(result?.id).toBe("018f8a32-1234-7000-8000-000000000001");
    expect(result?.targetRoute).toBe("/storage?location=018f8a32-1234-7000-8000-000000000001");
  });

  it("parses fuse://part/{id} links", () => {
    const result = parseDeepLink("fuse://part/018f8a32-9999-7000-8000-000000000002");
    expect(result).not.toBeNull();
    expect(result?.action).toBe("part");
    expect(result?.id).toBe("018f8a32-9999-7000-8000-000000000002");
    expect(result?.targetRoute).toBe("/parts/018f8a32-9999-7000-8000-000000000002");
  });

  it("parses fuse://scan links", () => {
    const result = parseDeepLink("fuse://scan");
    expect(result).not.toBeNull();
    expect(result?.action).toBe("scan");
    expect(result?.targetRoute).toBe("/scan");
  });

  it("parses fuse://resolve/{uuid} links", () => {
    const result = parseDeepLink("fuse://resolve/test-uuid-123");
    expect(result).not.toBeNull();
    expect(result?.action).toBe("resolve");
    expect(result?.id).toBe("test-uuid-123");
    expect(result?.targetRoute).toBe("/scan?resolve=test-uuid-123");
  });
});
