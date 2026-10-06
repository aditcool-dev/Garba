export const FESTIVAL = { nights: 9, name: "Navratri" } as const;
export const FESTIVAL_DAYS = Array.from({ length: FESTIVAL.nights }, (_, index) => `Day ${index + 1}`);
