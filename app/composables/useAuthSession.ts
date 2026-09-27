import { authClient } from "~/utils/auth-client";

export function useAuthSession() {
  return authClient.useSession(useFetch);
}
