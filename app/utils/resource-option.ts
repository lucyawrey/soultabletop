import type { ResourceSource } from "#shared/resource-list";

// An option in a resource dropdown or picker: the label (name and system, so
// it reads as the selected value and is searchable) plus the parts
// `<ResourceOption>` shows in the list.
export interface ResourceOptionItem {
  label: string;
  value: string;
  name: string;
  systemName?: string;
  source?: ResourceSource;
}

export function resourceOption(
  value: string,
  option: { name: string; systemName?: string; source?: ResourceSource },
): ResourceOptionItem {
  return {
    label: option.systemName
      ? `${option.name} · ${option.systemName}`
      : option.name,
    value,
    ...option,
  };
}
