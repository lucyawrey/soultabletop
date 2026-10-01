// `/api/content-type/<owner>/<readableId>`: the `/api/content-type/<id>` route, addressed by
// owner + readable ID (see `server/utils/resource-address.ts`).
import handler from "../[id].get";

defineRouteMeta({
  openAPI: {
    tags: ["Content Type"],
    summary: "Get a content type by owner and readable ID",
    description:
      "The same as `GET /api/content-type/{id}`, with the content type addressed by its owner's readable ID (a username or group readable ID) in `id` and its own readable ID in `readableId`, both case-insensitive. Not found (404) when nothing matches or the content type isn't readable.",
  },
});

export default handler;
