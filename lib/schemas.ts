import { z } from "zod";
export const profileSchema = z.object({ firstName: z.string().trim().min(1).max(40), age: z.number().int().min(18).max(100), bio: z.string().max(200), branch: z.string(), year: z.number().int().min(1).max(4), gender: z.string(), styles: z.array(z.string()), lookingFor: z.array(z.string()), availableNights: z.array(z.number().int().min(1).max(9)), interests: z.array(z.string()).max(6), partnerPreference: z.enum(["Everyone", "Women", "Men", "Non-binary"]) });
export const messageSchema = z.object({ body: z.string().trim().min(1).max(1000) });
export const reportSchema = z.object({ reason: z.enum(["harassment", "fake_profile", "inappropriate_content", "spam", "other"]), description: z.string().max(1000).optional() });
