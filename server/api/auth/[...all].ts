import { useAuth } from "../../utils/auth";

defineRouteMeta({
  openAPI: {
    tags: ["Authentication"],
    summary: "Better Auth endpoint",
    responses: {
      200: { description: "Authentication response" },
      401: { description: "Authentication required" },
    },
  },
});

export default defineEventHandler((event) => {
  return useAuth().handler(toWebRequest(event));
});
