// `/api/sheet/<owner>/<readableId>`: the `/api/sheet/<id>` route, addressed by
// owner + readable ID (see `server/utils/resource-address.ts`).
import handler from "../[id].delete";

defineRouteMeta({
  openAPI: {
    tags: ["Sheet"],
    summary: "Delete a sheet by owner and readable ID",
    description:
      "The same as `DELETE /api/sheet/{id}`, with the sheet addressed by its owner's readable ID (a username or group readable ID) in `id` and its own readable ID in `readableId`, both case-insensitive. Not found (404) when nothing matches or the sheet isn't readable.",
  },
});

export default handler;
