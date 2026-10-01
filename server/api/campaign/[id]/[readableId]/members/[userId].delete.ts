// `/api/campaign/<owner>/<readableId>/members/<userId>`: the
// `/api/campaign/<id>/members/<userId>` route, addressed by owner + readable ID
// (see `server/utils/resource-address.ts`).
import handler from "../../../[id]/members/[userId].delete";

defineRouteMeta({
  openAPI: {
    tags: ["Campaign"],
    summary: "Remove a campaign member by campaign owner and readable ID",
    description:
      "The same as `DELETE /api/campaign/{id}/members/{userId}`, with the campaign addressed by its owner's readable ID in `id` and its own readable ID in `readableId`.",
  },
});

export default handler;
