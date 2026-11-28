import { describe, expect, it } from "vitest";
import { jsonLdString } from "@/lib/json-ld";

describe("jsonLdString", () => {
  it("cannot close the surrounding <script> tag", () => {
    const evil = { name: 'Hani</script><script>alert(1)</script>', note: "a & b > c" };
    const out = jsonLdString(evil);
    expect(out).not.toMatch(/<|>|&/);
    expect(out.toLowerCase()).not.toContain("</script");
  });

  it("round-trips to the same data", () => {
    const data = { name: "Hani Beauty & Hair <3", line: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`, n: 1, list: ["x"] };
    expect(JSON.parse(jsonLdString(data))).toEqual(data);
  });
});
