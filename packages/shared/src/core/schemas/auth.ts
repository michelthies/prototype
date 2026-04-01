import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Min. 8 chars"),
});

export const signupValidator = zValidator("json", signupSchema, (result, c) => {
  if (!result.success) {
    return c.json({
      errors: result.error.issues.map((issue) => issue.message),
    });
  }
});
