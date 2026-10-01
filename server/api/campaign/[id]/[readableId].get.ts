// `/api/campaign/<owner>/<readableId>`: the `/api/campaign/<id>` route, addressed by
// owner + readable ID (see `server/utils/resource-address.ts`).
import handler from "../[id].get";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "Get a campaign by owner and readable ID",
    description:
      "The same as `GET /api/campaign/{id}`, with the campaign addressed by its owner's readable ID (a username or group readable ID) in `id` and its own readable ID in `readableId`, both case-insensitive. Not found (404) when nothing matches or the campaign isn't readable.",
  },
});

export default handler;
