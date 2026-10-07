import { cryptoRandom } from "#shared/sheet/roll";
import {
  runSheetAction,
  type SheetActionContext,
  type SheetFollowUp,
  type SheetRollEntry,
  type SheetWrite,
} from "#shared/sheet/runtime";
import type { ValidatedNode } from "#shared/sheet/validate";
import RollCard from "~/components/roll/Card.vue";

// Rolls from sheet actions (<Roll>, <FollowUp>): this page visit's Recent
// rolls, the one roll toast, and running actions. The content page provides
// it; a SheetRenderer without one (the Sheet editor's preview) provides its
// own. See docs/sheet-system.md, "Rolls".

// Where an action runs, read again at each click (a follow-up clicked later
// reads the sheet as it is then).
export interface SheetActionSite {
  context: () => Omit<SheetActionContext, "random" | "title" | "params">;
  // The action's name, for its entries ("Rapier").
  title: () => string;
  // Whether the viewer may write here now (edit rights, and Edit on or live).
  canWrite: () => boolean;
  update: (path: (string | number)[], value: unknown) => void;
  read: (path: (string | number)[]) => unknown;
}

export interface SheetRollLogEntry extends SheetRollEntry {
  id: number;
  when: Date;
  // The entry whose follow-up made this one.
  from?: number;
  // Follow-ups clicked at least once (by index).
  used: number[];
  // Reverts the writes of the click that made it (on its first entry).
  undo?: () => void;
  undone?: boolean;
  site: SheetActionSite;
}

export interface SheetRolls {
  entries: Ref<SheetRollLogEntry[]>;
  drawerOpen: Ref<boolean>;
  run: (steps: readonly ValidatedNode[], site: SheetActionSite, params?: Record<string, unknown>) => void;
  // `label`: the follow-up's label as shown, for messages.
  followUp: (entry: SheetRollLogEntry, index: number, label: string) => void;
  undo: (entry: SheetRollLogEntry) => void;
  clear: () => void;
}

const rollsKey: InjectionKey<SheetRolls> = Symbol("sheet-rolls");
const toastId = "roll";

export function provideSheetRolls(): SheetRolls {
  const toast = useToast();
  const entries = ref<SheetRollLogEntry[]>([]);
  const drawerOpen = ref(false);
  let nextId = 1;

  // Writes back the previous values, last first; a value changed since is
  // left as it is.
  function revert(site: SheetActionSite, writes: SheetWrite[]) {
    let skipped = 0;
    const written = new Map(writes.map((write) => [JSON.stringify(write.path), write.value]));
    for (const write of [...writes].reverse()) {
      const key = JSON.stringify(write.path);
      if (site.read(write.path) !== written.get(key)) {
        skipped += 1;
        continue;
      }
      site.update(write.path, write.previous);
      written.set(key, write.previous);
    }
    if (skipped) {
      toast.add({
        title: `Undo left ${skipped === 1 ? "1 value" : `${skipped} values`} as they are`,
        description: "They changed after the click.",
        color: "warning",
      });
    }
  }

  function showToast(entry: SheetRollLogEntry) {
    const content = {
      id: toastId,
      duration: Infinity,
      progress: false,
      description: () =>
        h(RollCard, {
          entry,
          onFollowUp: (index: number, label: string) => followUp(entry, index, label),
          onUndo: () => undo(entry),
        }),
      ui: { root: "p-0 gap-0", wrapper: "w-full", description: "text-default", actions: "absolute top-1.5 right-1.5" },
    };
    // A new roll replaces the toast's content (the same id).
    if (toast.toasts.value.some((item) => item.id === toastId)) toast.update(toastId, content);
    else toast.add(content);
  }

  function run(
    steps: readonly ValidatedNode[],
    site: SheetActionSite,
    params?: Record<string, unknown>,
    from?: SheetRollLogEntry,
    label?: string,
  ) {
    const title = site.title();
    const result = runSheetAction(steps, {
      ...site.context(),
      params: params as SheetActionContext["params"],
      random: cryptoRandom,
      title,
    });
    if ("error" in result) {
      toast.add({
        title: `${label ?? title} didn't work`,
        description: result.error,
        color: "error",
        icon: "i-lucide-triangle-alert",
      });
      return;
    }
    if (result.writes.length && !site.canWrite()) {
      toast.add({ title: `${label ?? title} needs edit access`, color: "error", icon: "i-lucide-triangle-alert" });
      return;
    }
    for (const write of result.writes) site.update(write.path, write.value);
    const writes = result.writes;
    const made = result.entries.map<SheetRollLogEntry>((entry, index) => ({
      ...entry,
      id: nextId++,
      when: new Date(),
      ...(from ? { from: from.id } : {}),
      used: [],
      site,
      ...(index === 0 && writes.length ? { undo: () => revert(site, writes) } : {}),
    }));
    if (made.length) {
      entries.value = [...made.reverse(), ...entries.value];
      showToast(entries.value[0]!);
    } else if (writes.length) {
      // Only Sets (a follow-up that writes): a toast with Undo, like a Button.
      toast.add({
        title: label ?? title,
        actions: [{ label: "Undo", color: "neutral", variant: "outline", onClick: () => revert(site, writes) }],
      });
    }
  }

  function followUp(entry: SheetRollLogEntry, index: number, label: string) {
    const offered: SheetFollowUp | undefined = entry.followUps[index];
    if (!offered) return;
    const current = entries.value.find((item) => item.id === entry.id);
    if (current && !current.used.includes(index)) current.used = [...current.used, index];
    run(offered.node.children, entry.site, offered.params, entry, label);
  }

  function undo(entry: SheetRollLogEntry) {
    const current = entries.value.find((item) => item.id === entry.id);
    if (!current?.undo || current.undone) return;
    current.undo();
    current.undone = true;
  }

  function clear() {
    entries.value = [];
    toast.remove(toastId);
  }

  const rolls: SheetRolls = {
    entries,
    drawerOpen,
    run: (steps, site, params) => run(steps, site, params),
    followUp,
    undo,
    clear,
  };
  provide(rollsKey, rolls);
  return rolls;
}

export function injectSheetRolls() {
  return inject(rollsKey, null);
}

export function useSheetRolls(): SheetRolls {
  const rolls = inject(rollsKey, null);
  if (!rolls) throw new Error("Sheet rolls need provideSheetRolls (the content page or a SheetRenderer)");
  return rolls;
}
