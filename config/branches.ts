export const BRANCHES = ["CSE", "ISE", "ECE", "EEE", "ME", "CV", "AI&ML", "AI&DS", "Other"] as const;
export const BRANCH_CODES: Record<string, (typeof BRANCHES)[number]> = { cs: "CSE", is: "ISE", ec: "ECE", ee: "EEE", me: "ME", cv: "CV", ai: "AI&ML", ad: "AI&DS" };
