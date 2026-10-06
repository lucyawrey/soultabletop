// `/api/content-type/<owner>/<readableId>/preview`: the
// `/api/content-type/<id>/preview` route, addressed by owner + readable ID (see
// `server/utils/resource-address.ts`).
import handler from "../preview.get";

defineRouteMeta({
  openAPI: {
    tags: ["ContentType"],
    summary: "Get the Sheet that previews a content type's content, by owner and readable ID",
    description:
      "The same as `GET /api/content-type/{id}/preview`, with the content type addressed by its owner's readable ID in `id` and its own readable ID in `readableId`.",
  },
});

export default handler;
