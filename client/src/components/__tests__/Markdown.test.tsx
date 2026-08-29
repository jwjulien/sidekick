import { render } from "@solidjs/testing-library";
import { describe, it, expect } from "vitest";
import Markdown from "../Markdown";

describe("Markdown Component", () => {
  it("renders fallback text when content is empty or undefined", () => {
    const { container } = render(() => <Markdown content="" fallback="No notes provided." />);
    expect(container).toHaveTextContent("No notes provided.");
  });

  it("renders lists correctly (bulleted, numbered, and task lists)", () => {
    const markdownText = `
- Bullet item 1
- Bullet item 2

1. First step
2. Second step

- [ ] Unchecked task
- [x] Completed task
`;
    const { container } = render(() => <Markdown content={markdownText} />);
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelectorAll("li").length).toBeGreaterThanOrEqual(4);
    
    // Task checkboxes
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBe(2);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
  });

  it("renders GFM tables wrapped in responsive container", () => {
    const markdownTable = `
| Component | SKU | Quantity |
| --- | --- | --- |
| Resistor 10k | R-10K-0805 | 100 |
| Capacitor 100nF | C-100N-0603 | 50 |
`;
    const { container } = render(() => <Markdown content={markdownTable} />);
    const tableWrapper = container.querySelector(".markdown-table-wrapper");
    expect(tableWrapper).not.toBeNull();
    expect(container.querySelectorAll("th").length).toBe(3);
    expect(container.querySelectorAll("td").length).toBe(6);
    expect(container).toHaveTextContent("Resistor 10k");
  });

  it("renders GitHub callouts and container admonitions", () => {
    const admonitionsText = `
> [!NOTE]
> This is a note callout.

> [!WARNING]
> High voltage risk!

::: tip
Use ESD wrist straps when handling sensitive ICs.
:::
`;
    const { container } = render(() => <Markdown content={admonitionsText} />);
    
    const noteAdmonition = container.querySelector(".admonition-note");
    expect(noteAdmonition).not.toBeNull();
    expect(noteAdmonition).toHaveTextContent("NOTE");
    expect(noteAdmonition).toHaveTextContent("This is a note callout.");

    const warningAdmonition = container.querySelector(".admonition-warning");
    expect(warningAdmonition).not.toBeNull();
    expect(warningAdmonition).toHaveTextContent("WARNING");
    expect(warningAdmonition).toHaveTextContent("High voltage risk!");

    const tipAdmonition = container.querySelector(".admonition-tip");
    expect(tipAdmonition).not.toBeNull();
    expect(tipAdmonition).toHaveTextContent("TIP");
    expect(tipAdmonition).toHaveTextContent("Use ESD wrist straps when handling sensitive ICs.");
  });

  it("renders abbreviation definitions as <abbr> elements", () => {
    const abbrText = `
Assembly uses SMD components and a custom PCB design.

*[SMD]: Surface Mount Device
*[PCB]: Printed Circuit Board
`;
    const { container } = render(() => <Markdown content={abbrText} />);
    const abbrs = container.querySelectorAll("abbr");
    expect(abbrs.length).toBe(2);

    const smdAbbr = Array.from(abbrs).find((el) => el.textContent === "SMD");
    expect(smdAbbr).not.toBeUndefined();
    expect(smdAbbr?.getAttribute("title")).toBe("Surface Mount Device");

    const pcbAbbr = Array.from(abbrs).find((el) => el.textContent === "PCB");
    expect(pcbAbbr).not.toBeUndefined();
    expect(pcbAbbr?.getAttribute("title")).toBe("Printed Circuit Board");
  });

  it("renders inline code and code blocks properly styled", () => {
    const codeText = `
Run \`npm run build\` to create production assets.

\`\`\`javascript
const speed = 100;
console.log("Status:", speed);
\`\`\`
`;
    const { container } = render(() => <Markdown content={codeText} />);
    expect(container.querySelector("code")).not.toBeNull();
    expect(container.querySelector("pre")).not.toBeNull();
    expect(container).toHaveTextContent("npm run build");
    expect(container).toHaveTextContent("console.log");
  });

  it("sanitizes dangerous scripts and inline handlers to prevent XSS", () => {
    const dangerousText = `
Safe text
<script>alert('xss')</script>
<img src="x" onerror="alert('xss')" />
<a href="javascript:alert('xss')">Click Link</a>
`;
    const { container } = render(() => <Markdown content={dangerousText} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    const linkEl = container.querySelector("a");
    expect(linkEl?.getAttribute("href")).toBeNull();
    expect(container).toHaveTextContent("Safe text");
  });
});
