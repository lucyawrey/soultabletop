// `/api/campaign/<owner>/<readableId>/members`: the `/api/campaign/<id>/members`
// route, addressed by owner + readable ID (see `server/utils/resource-address.ts`).
import handler from "../../[id]/members.post";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "Add or update a campaign member by campaign owner and readable ID",
    description:
      "The same as `POST /api/campaign/{id}/members`, with the campaign addressed by its owner's readable ID in `id` and its own readable ID in `readableId`.",
  },
});

export default handler;
