import { systemIdPrefix } from "#shared/system-id-prefix";

// The prefix for generated IDs of resources in a system (see
// `systemIdPrefix`), or undefined while the system isn't known.
export function useSystemIdPrefix() {
  const { findSystem } = useSystems();
  return (systemId: string | null | undefined) => {
    const system = findSystem(systemId);
    return system ? systemIdPrefix(system.readableId) : undefined;
  };
}
