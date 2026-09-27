import { requireAuthenticatedUser } from "../../utils/auth";
import { ensureUserProfile } from "../../utils/user-profile";

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  return ensureUserProfile(user);
});
