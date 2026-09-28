// `isPubliclyReadable` is shown as "Visibility" in the UI. `false` is "Limited",
// not "Private", because a non-public Resource can still be shared via grants.
export function visibilityLabel(isPubliclyReadable: boolean) {
  return isPubliclyReadable ? "Public" : "Limited";
}
