import { requireAuthenticatedUser } from "../../utils/auth";
import { ensureUserProfile } from "../../utils/user-profile";

defineRouteMeta({
  openAPI: {
    tags: ["Profile"],
    summary: "Get the current user's profile",
    responses: {
      200: { description: "Profile" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event);
  return ensureUserProfile(user);
});
