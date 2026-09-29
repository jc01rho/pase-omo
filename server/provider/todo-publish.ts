import type { ProviderTimelineItem } from "@getpaseo/plugin/server/provider";

import { PLUGIN_ID } from "../../shared/ids.js";
import { TODO_ROW_KIND, TODO_ROW_VERSION, markOmoTodoItems, toTodoRow } from "../../shared/todo.js";

/** One todo entry as the timeline item carries it. */
export type TodoPublishItem = {
  text: string;
  completed: boolean;
  status?: "pending" | "in_progress" | "completed";
};

export type TodoPublishDecision = {
  publish: boolean;
  signature: string;
  items: TodoPublishItem[];
};

function signatureOf(items: readonly TodoPublishItem[]): string {
  return JSON.stringify(
    items.map((item) => [item.text, item.status ?? (item.completed ? "completed" : "pending")]),
  );
}

/**
 * Remembers the latest todo list without drawing it.
 *
 * Every publication of a `todo` item becomes its own row in Paseo's timeline -
 * unlike a streaming assistant message, a repeated id does not rewrite the card
 * - so publishing each change is what stacked five near-identical lists down
 * the chat. Live progress is not lost by holding them: Paseo shows the running
 * count in the composer itself while the turn works.
 */
export function holdTodo(items: readonly TodoPublishItem[]): TodoPublishDecision {
  return { publish: false, signature: signatureOf(items), items: [...items] };
}

/**
 * The one card a finished turn draws, when it has something new to say.
 *
 * Returns publish=false when the turn touched no list, or ended on exactly the
 * card already in the conversation.
 */
export function finalTodoPublication(
  previousSignature: string | undefined,
  pending: readonly TodoPublishItem[] | undefined,
): { publish: boolean; signature: string | undefined; items?: TodoPublishItem[] } {
  if (pending === undefined || pending.length === 0) return { publish: false, signature: previousSignature };
  const signature = signatureOf(pending);
  if (signature === previousSignature) return { publish: false, signature };
  return { publish: true, signature, items: [...pending] };
}

/**
 * The timeline items one todo publication becomes.
 *
 * The card is a plugin row: Paseo draws a plugin row exactly once per id,
 * whereas it splits a native `todo` item into one row per task that changed,
 * each carrying the whole list. The native item is still sent, marked so the
 * client transformer hides it, because it is what the composer's task chip
 * reads.
 */
export function todoTimelineItems(
  nativeId: string,
  cardId: string,
  items: readonly TodoPublishItem[],
): ProviderTimelineItem[] {
  const marked = markOmoTodoItems(items);
  const row = toTodoRow(marked, "complete");
  const native: ProviderTimelineItem = { type: "todo", id: nativeId, items: marked };
  if (row === null) return [native];
  return [
    native,
    { type: "plugin", id: cardId, pluginId: PLUGIN_ID, kind: TODO_ROW_KIND, version: TODO_ROW_VERSION, data: row },
  ];
}
