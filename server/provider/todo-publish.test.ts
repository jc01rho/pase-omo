import { describe, expect, it } from "vitest";
import { PLUGIN_ID } from "../../shared/ids.js";
import { TODO_ROW_KIND, TODO_ROW_VERSION, TodoRowSchema, todoPluginItems } from "../../shared/todo.js";
import { finalTodoPublication, holdTodo, todoTimelineItems } from "./todo-publish.js";

/**
 * Every publication of a todo item becomes its own timeline row, so the card is
 * drawn once per turn - in the state the turn ended in. Live progress is not
 * lost: Paseo shows the running task count in the composer while the turn works.
 */
const items = (...statuses: Array<"pending" | "in_progress" | "completed">) =>
  statuses.map((status, index) => ({ text: `task-${index}`, completed: status === "completed", status }));

describe("holdTodo", () => {
  it("never draws during the turn", () => {
    expect(holdTodo(items("pending", "pending")).publish).toBe(false);
  });

  it("keeps the list it was given for the end of the turn", () => {
    expect(holdTodo(items("completed", "pending")).items).toEqual(items("completed", "pending"));
  });
});

describe("finalTodoPublication", () => {
  it("draws the state the turn ended in", () => {
    const held = holdTodo(items("completed", "in_progress"));
    const final = finalTodoPublication(undefined, held.items);

    expect(final.publish).toBe(true);
    expect(final.items).toEqual(items("completed", "in_progress"));
  });

  it("draws nothing for a turn that never touched a list", () => {
    expect(finalTodoPublication(undefined, undefined).publish).toBe(false);
  });

  it("draws nothing when the turn ended on the card already shown", () => {
    const held = holdTodo(items("completed", "completed"));
    const first = finalTodoPublication(undefined, held.items);

    expect(finalTodoPublication(first.signature, held.items).publish).toBe(false);
  });
});

describe("todoTimelineItems", () => {
  const published = todoTimelineItems("todo-s1", "todo-card-1", items("completed", "completed", "in_progress", "pending"));

  it("draws the card as one plugin row", () => {
    const cards = published.filter((item) => item.type === "plugin");

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "todo-card-1", pluginId: PLUGIN_ID, kind: TODO_ROW_KIND, version: TODO_ROW_VERSION });
    const row = TodoRowSchema.parse(cards[0]?.type === "plugin" ? cards[0].data : null);
    expect(row).toMatchObject({ total: 4, completed: 2, phase: "complete" });
  });

  it("keeps the native item for the task chip, hidden by the client transformer", () => {
    // Paseo may split this one item into a row per changed task; every one of
    // them carries the same marked list, so every one is hidden.
    const native = published.find((item) => item.type === "todo");

    expect(native).toMatchObject({ id: "todo-s1" });
    expect(todoPluginItems(native, "complete")).toEqual({ items: [] });
  });
});
