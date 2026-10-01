import { MAX_USERNAME_LENGTH } from "../../../shared/display-name";
import { createError, getQuery } from "h3";
import { isOwnerReadableIdTaken } from "../../utils/owner-readable-id";

defineRouteMeta({
  openAPI: {
    tags: ["Profile"],
    summary: "Check username availability",
    responses: {
      200: { description: "Availability result" },
      400: { description: "Invalid username" },
    },
  },
});

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  if (typeof query.username !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "username is required",
    });
  }

  const username = query.username.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: "username must use lowercase letters, numbers, and hyphens",
    });
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `username must be at most ${MAX_USERNAME_LENGTH} characters`,
    });
  }

  // Usernames share a namespace with group readable IDs.
  return { available: !(await isOwnerReadableIdTaken(username)) };
});
