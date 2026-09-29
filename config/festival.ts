export const FESTIVAL = { startDate: "2026-10-18T18:00:00+05:30", nights: 9, name: "Navratri" } as const;
export const FESTIVAL_DAYS = Array.from({ length: FESTIVAL.nights }, (_, index) => `Day ${index + 1}`);
