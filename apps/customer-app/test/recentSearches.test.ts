import { describe, expect, it } from "vitest";
import { rememberSearch } from "../src/lib/recentSearches";

describe("recent searches", () => {
  it("puts the newest first and drops an older copy of the same term", () => {
    expect(rememberSearch(["milk", "bread"], "Bread")).toEqual(["Bread", "milk"]);
  });

  it("ignores empty or one letter terms and tidies spaces", () => {
    expect(rememberSearch(["milk"], " ")).toEqual(["milk"]);
    expect(rememberSearch(["milk"], "a")).toEqual(["milk"]);
    expect(rememberSearch([], "  brown   bread ")).toEqual(["brown bread"]);
  });

  it("keeps only the latest few", () => {
    const many = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];
    expect(rememberSearch(many, "new")).toHaveLength(8);
    expect(rememberSearch(many, "new")[0]).toBe("new");
  });
});
