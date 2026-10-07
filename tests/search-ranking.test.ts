import { describe, expect, it } from "vitest";
import { normalizeSearch, rankSearchProfiles } from "../lib/search-ranking";
import type { Profile } from "../lib/supabase/types";

const make = (name: string, extra: Partial<Profile> = {}): Profile => ({ id: name, first_name: name, branch: "CSE", styles: ["Dandiya"], bio: "", available_nights: [1], interests: [], looking_for: [], year: 1, ...extra } as Profile);
describe("Discover relevance", () => {
  it("normalizes whitespace, case and diacritics", () => {
    expect(normalizeSearch("  ÁDÍT  Dev \n")).toBe("adit dev");
    expect(rankSearchProfiles([make("ÁDÍTÍ")], " aDIt ", null)[0].first_name).toBe("ÁDÍTÍ");
  });
  it("ranks first-word prefixes, other words, substrings then bio/style/branch", () => {
    const names = ["Radit", "Anirudha Aditya", "Aditya Dev", "Aditi", "Aditya"];
    const rows = [make("Bio dancer", { bio: "Learning adit steps" }), ...names.map(n => make(n))];
    expect(rankSearchProfiles(rows, "Adit", null).map(p => p.first_name)).toEqual(["Aditi", "Aditya", "Aditya Dev", "Anirudha Aditya", "Radit", "Bio dancer"]);
    expect(rankSearchProfiles([...rows].reverse(), "Adit", null)).toEqual(rankSearchProfiles(rows, "Adit", null));
  });
  it("sorts exact full words ahead of compatibility, then score and alphabet", () => {
    const me = make("Me");
    const rows = [make("Aditya", { available_nights: [] }), make("Aditi"), make("Adit", { available_nights: [] }), make("Aditya Dev")];
    expect(rankSearchProfiles(rows, "adit", me).map(p => p.first_name)).toEqual(["Adit", "Aditi", "Aditya Dev", "Aditya"]);
    expect(rankSearchProfiles([make("Anirudha Aditya"), make("Zara Adit", { available_nights: [] })], "adit", me)[0].first_name).toBe("Zara Adit");
  });
  it("matches bio, branch or style but not ID/email", () => {
    const rows = [make("One", { branch: "ADIT" }), make("Two", { styles: ["Adit dance"] }), make("Three", { bio: "adit" }), make("Four", { id: "adit" })];
    expect(rankSearchProfiles(rows, "adit", null).map(p => p.first_name)).toEqual(["One", "Three", "Two"]);
    expect(rankSearchProfiles(rows, "student@bmsce.ac.in", null)).toEqual([]);
    expect(rankSearchProfiles([make("Substring", { bio: "Radit" }), make("Full word", { bio: "Let's try adit!", available_nights: [] })], "adit", make("Me"))[0].first_name).toBe("Full word");
  });
});
