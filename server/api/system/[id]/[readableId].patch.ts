// `/api/system/<owner>/<readableId>`: the `/api/system/<id>` route, addressed by
// owner + readable ID (see `server/utils/resource-address.ts`).
import handler from "../[id].patch";

defineRouteMeta({
  openAPI: {
    tags: ["System"],
    summary: "Update a system by owner and readable ID",
    description:
      "The same as `PATCH /api/system/{id}`, with the system addressed by its owner's readable ID (a username or group readable ID) in `id` and its own readable ID in `readableId`, both case-insensitive. Not found (404) when nothing matches or the system isn't readable.",
  },
});

export default handler;
