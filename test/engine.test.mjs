import test from "node:test";
import assert from "node:assert/strict";
import {
  deck,
  shuffle,
  createGame,
  act,
  placements,
  royalSlots,
  armourSlots,
  damage,
  lanes,
  kills,
} from "../engine.mjs";
const c = (rank, suit = "S") => ({ rank, suit, id: `${suit}${rank}` });
const r = (rank, suit = "S", armour = 0) => ({
  card: c(rank, suit),
  armour,
  armourCards: [],
  dead: false,
});
function fixture(mode = "revised") {
  return {
    mode,
    deck: [c(8, "D")],
    grid: Array.from({ length: 9 }, () => [c(2)]),
    royals: Array(12).fill(null),
    ploys: [],
    spent: [],
    shame: [],
    queue: [],
    pending: null,
    stage: "play",
    status: "playing",
    turns: 0,
    message: "",
  };
}
test("standard 54-card deck, unique identities, reproducible shuffle", () => {
  assert.equal(deck().length, 54);
  assert.equal(new Set(deck().map((c) => c.id)).size, 54);
  assert.deepEqual(
    shuffle(deck(), () => 0.5),
    shuffle(deck(), () => 0.5),
  );
  assert.equal(deck().filter((c) => c.rank >= 11).length, 12);
});
test("revised setup banks specials and queues royals; original leaves centre empty", () => {
  const s = createGame("revised", deck());
  assert.equal(s.grid.flat().length, 9);
  assert.equal(s.ploys.length, 1);
  assert.equal(s.stage, "mulligan");
  const v1 = createGame("classic", deck());
  assert.equal(v1.grid[4].length, 0);
  assert.equal(v1.grid.flat().length, 8);
  assert.equal(v1.grid[0][0].rank, 1);
  const royalsFirst = createGame("revised", [
    ...deck().filter((c) => c.rank >= 11),
    ...deck().filter((c) => c.rank < 11),
  ]);
  assert.equal(royalsFirst.pending.rank, 11);
  assert.equal(royalsFirst.queue.length, 11);
});
test("opening choice is once only and replacement special/royal draws are resolved", () => {
  let s = createGame("revised", deck());
  s.deck = [c(1, "D"), c(12, "H"), c(3, "C")];
  s = act(s, { type: "replace", index: 0 });
  assert.equal(s.grid[0][0].rank, 3);
  assert.equal(s.ploys.length, 2);
  assert.equal(s.stage, "replacement");
  s = act(s, { type: "royal", index: royalSlots(s)[0] });
  assert.equal(s.stage, "play");
  assert.throws(() => act(s, { type: "replace", index: 1 }));
});
test("number placement rejects higher values atomically, permits equal and empty", () => {
  const s = fixture();
  s.pending = c(4);
  s.grid[0] = [c(5)];
  s.grid[1] = [];
  const before = structuredClone(s);
  assert.throws(() => act(s, { type: "place", index: 0 }));
  assert.deepEqual(s, before);
  assert.ok(placements(s).includes(1));
  assert.ok(placements(s).includes(2));
  assert.equal(act(s, { type: "place", index: 1 }).grid[1][0].rank, 4);
  assert.throws(() => act(s, { type: "place", index: 12 }));
});
test("royal similarity prioritizes suit then colour then rank and ignores occupied sides", () => {
  const s = fixture();
  s.pending = c(13, "H");
  s.grid = Array.from({ length: 9 }, () => [c(10, "S")]);
  s.grid[0] = [c(3, "H")];
  s.grid[2] = [c(9, "D")];
  s.grid[4] = [c(10, "H")];
  assert.deepEqual(royalSlots(s), [0, 11]);
  s.royals[0] = r(11);
  s.royals[11] = r(12);
  s.royals[11].dead = true;
  assert.deepEqual(royalSlots(s), [2, 3]);
  s.grid[2] = [c(9, "C")];
  assert.ok(royalSlots(s).includes(1));
  assert.throws(() => act(s, { type: "royal", index: 0 }));
});
test("all twelve lanes fire from opposite end; trigger rank is not damage", () => {
  lanes.forEach((lane, slot) => {
    const s = fixture();
    s.royals[slot] = r(11);
    s.grid[lane[0]] = [c(6)];
    s.grid[lane[1]] = [c(5, "D")];
    s.pending = c(2);
    assert.equal(damage(s, slot), 11);
    const next = act(s, { type: "place", index: lane[2] });
    assert.equal(next.royals[slot].dead, true);
    assert.equal(s.royals[slot].dead, false);
  });
});
test("failed shots do not damage or kill; queen colour and king suit are enforced", () => {
  const s = fixture();
  s.royals[0] = r(12, "H");
  s.grid[0] = [c(10, "H")];
  s.grid[3] = [c(9, "S")];
  s.pending = c(10);
  assert.equal(damage(s, 0), 10);
  assert.equal(act(s, { type: "place", index: 6 }).royals[0].dead, false);
  s.grid[3] = [c(2, "D")];
  assert.equal(damage(s, 0), 12);
  s.royals[0] = r(13, "H");
  assert.equal(damage(s, 0), 10);
  s.grid[3] = [c(3, "H")];
  assert.equal(damage(s, 0), 13);
});
test("one corner play can kill two royals; dead royals remain occupied", () => {
  const s = fixture();
  s.royals[0] = r(11);
  s.royals[5] = r(11);
  s.grid[0] = [c(6)];
  s.grid[3] = [c(5)];
  s.grid[8] = [c(6)];
  s.grid[7] = [c(5)];
  s.pending = c(2);
  const next = act(s, { type: "place", index: 6 });
  assert.equal(kills(next), 2);
  assert.equal(next.royals[0].card.rank, 11);
});
test("ace extraction recycles the whole stack and preserves the pending draw", () => {
  const s = fixture();
  s.ploys = [c(1)];
  s.pending = c(3);
  s.grid[2] = [c(2), c(5)];
  const next = act(s, { type: "extract", index: 2 });
  assert.deepEqual(next.deck.slice(-2), s.grid[2]);
  assert.deepEqual(next.pending, s.pending);
  assert.equal(next.grid[2].length, 0);
  assert.equal(next.spent.length, 1);
  assert.throws(() => act(next, { type: "extract", index: 0 }));
});
test("joker moves only the top, consumes once, fires and validates target", () => {
  const s = fixture();
  s.ploys = [c(0, "X")];
  s.grid[4] = [c(2), c(4)];
  s.grid[0] = [c(6)];
  s.grid[3] = [c(5)];
  s.royals[0] = r(11);
  assert.throws(() => act(s, { type: "move", from: 4, index: 0 }));
  assert.throws(() => act(s, { type: "move", from: 4, index: 4 }));
  const next = act(s, { type: "move", from: 4, index: 6 });
  assert.equal(next.grid[4].length, 1);
  assert.equal(next.grid[6].at(-1).rank, 4);
  assert.equal(next.royals[0].dead, true);
  assert.equal(next.ploys.length, 0);
});
test("armour requires blocked placement and no revised ploys, ranks base royals not armour", () => {
  const s = fixture();
  s.grid = s.grid.map(() => [c(10)]);
  s.pending = c(3, "H");
  s.royals[0] = r(11, "H", 2);
  s.royals[1] = r(12, "H");
  s.royals[2] = r(11, "D");
  assert.deepEqual(armourSlots(s), [0]);
  s.ploys = [c(1)];
  assert.deepEqual(armourSlots(s), []);
  s.ploys = [];
  const next = act(s, { type: "armour", index: 0 });
  assert.equal(next.royals[0].armour, 5);
  assert.equal(next.pending, null);
  s.grid[0] = [];
  assert.throws(() => act(s, { type: "armour", index: 0 }));
});
test("revised armour thresholds terminate at 20 or 19 for kings", () => {
  for (const [rank, armour, add, expected] of [
    [11, 5, 3, "playing"],
    [11, 6, 3, "lost"],
    [12, 5, 3, "lost"],
    [13, 3, 3, "lost"],
  ]) {
    const s = fixture();
    s.grid = s.grid.map(() => [c(10)]);
    s.pending = c(add);
    s.royals[0] = r(rank, "S", armour);
    assert.equal(act(s, { type: "armour", index: 0 }).status, expected);
  }
});
test("deck exhaustion preserves a last playable card; ploys can rescue empty deck", () => {
  const s = fixture();
  s.royals[0] = r(11);
  s.deck = [c(3)];
  let next = act(s, { type: "draw" });
  assert.equal(next.status, "playing");
  next = act(next, { type: "place", index: 4 });
  assert.equal(next.status, "lost");
  assert.throws(() => act(next, { type: "draw" }));
  s.ploys = [c(1)];
  next = act(s, { type: "draw" });
  next = act(next, { type: "place", index: 4 });
  assert.equal(next.status, "playing");
  next = act(next, { type: "extract", index: 4 });
  assert.ok(next.deck.length);
});
test("twelve kills wins, including a final card on an exhausted deck", () => {
  const s = fixture();
  s.deck = [];
  s.royals = Array.from({ length: 12 }, () => ({ ...r(11), dead: true }));
  s.royals[0].dead = false;
  s.grid[0] = [c(6)];
  s.grid[3] = [c(5)];
  s.pending = c(2);
  assert.equal(act(s, { type: "place", index: 6 }).status, "won");
});
test("no living royal cycles non-royals including ploys under the deck", () => {
  const s = fixture();
  s.deck = [c(1), c(4), c(11), c(8)];
  const next = act(s, { type: "draw" });
  assert.equal(next.pending.rank, 11);
  assert.deepEqual(
    next.deck.map((c) => c.rank),
    [8, 1, 4],
  );
  assert.equal(next.ploys.length, 0);
});
test("classic ace/joker resets are placed, can fire, and recycle previous stack", () => {
  for (const rank of [0, 1]) {
    const s = fixture("classic");
    s.pending = c(rank);
    s.grid[6] = [c(3), c(10)];
    s.grid[0] = [c(6)];
    s.grid[3] = [c(5)];
    s.royals[0] = r(11);
    const next = act(s, { type: "place", index: 6 });
    assert.equal(next.grid[6].length, 1);
    assert.equal(next.grid[6][0].rank, rank);
    assert.deepEqual(next.deck.slice(-2), s.grid[6]);
    assert.equal(next.royals[0].dead, true);
  }
});
test("classic hard reset and empty-deck refill use distinct shame rules", () => {
  const s = fixture("classic");
  s.grid = s.grid.map(() => [c(10)]);
  s.pending = c(3);
  let next = act(s, { type: "reset", index: 0 });
  assert.equal(next.shame[0].rank, 3);
  assert.equal(next.grid[0].length, 0);
  assert.equal(next.deck.at(-1).rank, 10);
  s.pending = null;
  s.deck = [];
  s.grid[0] = [c(2), c(4), c(10)];
  next = act(s, { type: "refill", index: 0 });
  assert.equal(next.shame[0].rank, 10);
  assert.deepEqual(
    next.deck.map((c) => c.rank),
    [2, 4],
  );
});
