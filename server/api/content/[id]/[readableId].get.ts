// `/api/content/<owner>/<readableId>`: the `/api/content/<id>` route, addressed by
// owner + readable ID (see `server/utils/resource-address.ts`).
import handler from "../[id].get";

defineRouteMeta({
  openAPI: {
    tags: ["Content"],
    summary: "Get a content record by owner and readable ID",
    description:
      "The same as `GET /api/content/{id}`, with the content record addressed by its owner's readable ID (a username or group readable ID) in `id` and its own readable ID in `readableId`, both case-insensitive. Not found (404) when nothing matches or the content record isn't readable.",
  },
});

export default handler;
