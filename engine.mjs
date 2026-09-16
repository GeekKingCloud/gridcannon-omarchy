export const suits = ["S", "H", "C", "D"];
export const symbols = { S: "♠", H: "♥", C: "♣", D: "♦", X: "✦" };
export const color = (c) => (["H", "D"].includes(c?.suit) ? "red" : "black");
export const top = (stack) => stack.at(-1);
export const label = (c) =>
  c
    ? `${{ 0: "Joker", 1: "A", 11: "J", 12: "Q", 13: "K" }[c.rank] ?? c.rank}${symbols[c.suit]}`
    : "Empty";
export const royal = (c) => c?.rank >= 11;
export const special = (c) => c?.rank < 2;
// Clockwise: north left-to-right, east top-to-bottom, south right-to-left, west bottom-to-top.
export const lanes = [
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [2, 1, 0],
  [5, 4, 3],
  [8, 7, 6],
  [8, 5, 2],
  [7, 4, 1],
  [6, 3, 0],
  [6, 7, 8],
  [3, 4, 5],
  [0, 1, 2],
];
export const slotNames = [
  "North 1",
  "North 2",
  "North 3",
  "East 1",
  "East 2",
  "East 3",
  "South 3",
  "South 2",
  "South 1",
  "West 3",
  "West 2",
  "West 1",
];
export function deck() {
  return [
    ...suits.flatMap((suit) =>
      Array.from({ length: 13 }, (_, i) => ({
        id: `${suit}${i + 1}`,
        suit,
        rank: i + 1,
      })),
    ),
    ...[0, 1].map((i) => ({ id: `X${i}`, suit: "X", rank: 0 })),
  ];
}
export function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const affinity = (a, b) =>
  !b
    ? 0
    : a.suit === b.suit
      ? 2
      : color(a) === color(b) && b.suit !== "X"
        ? 1
        : 0;
export function placements(s, card = s.pending) {
  if (!card || royal(card)) return [];
  return s.grid.flatMap((stack, i) =>
    !stack.length ||
    (s.mode === "classic" && special(card)) ||
    top(stack).rank <= card.rank
      ? [i]
      : [],
  );
}
export function royalSlots(s, card = s.pending) {
  const candidates = lanes.flatMap(([near], i) =>
    s.royals[i] ? [] : [{ i, c: top(s.grid[near]) }],
  );
  const best = Math.max(
    ...candidates.map((x) => affinity(card, x.c) * 100 + (x.c?.rank ?? 0)),
  );
  return candidates
    .filter((x) => affinity(card, x.c) * 100 + (x.c?.rank ?? 0) === best)
    .map((x) => x.i);
}
export function armourSlots(s) {
  if (
    !s.pending ||
    royal(s.pending) ||
    placements(s).length ||
    (s.mode === "revised" && s.ploys.length)
  )
    return [];
  const candidates = s.royals.flatMap((r, i) =>
    r && !r.dead ? [{ i, r }] : [],
  );
  const best = Math.max(
    ...candidates.map(
      ({ r }) => affinity(s.pending, r.card) * 100 - r.card.rank,
    ),
  );
  return candidates
    .filter(({ r }) => affinity(s.pending, r.card) * 100 - r.card.rank === best)
    .map((x) => x.i);
}
export function damage(s, slot) {
  const r = s.royals[slot];
  if (!r || r.dead) return 0;
  return lanes[slot]
    .slice(0, 2)
    .map((i) => top(s.grid[i]))
    .reduce((sum, c) => {
      const matches =
        c &&
        (r.card.rank === 11 ||
          (r.card.rank === 12
            ? color(c) === color(r.card)
            : c.suit === r.card.suit));
      return sum + (matches ? c.rank : 0);
    }, 0);
}
function attack(s, trigger) {
  const killed = [];
  lanes.forEach((lane, slot) => {
    const r = s.royals[slot];
    if (
      r &&
      !r.dead &&
      lane[2] === trigger &&
      damage(s, slot) >= r.card.rank + r.armour
    ) {
      r.dead = true;
      killed.push(label(r.card));
    }
  });
  if (killed.length)
    s.message = `Cannon fired. Defeated ${killed.join(" and ")}.`;
}
export const kills = (s) => s.royals.filter((r) => r?.dead).length;
function settle(s) {
  if (kills(s) === 12) {
    s.status = "won";
    s.message =
      s.mode === "classic"
        ? `All twelve defeated. Shame: ${s.shame.length}.`
        : `All twelve defeated. Unspent ploys: ${s.ploys.length}/6.`;
  } else if (
    s.mode === "revised" &&
    s.royals.some(
      (r) =>
        r &&
        !r.dead &&
        r.card.rank + r.armour >= (r.card.rank === 13 ? 19 : 20),
    )
  ) {
    s.status = "lost";
    s.message = "The armour is impenetrable. This siege is over.";
  } else if (
    s.stage === "play" &&
    !s.pending &&
    !s.deck.length &&
    !s.ploys.length &&
    s.mode === "revised"
  ) {
    s.status = "lost";
    s.message = "No cards or ploys remain. This siege is over.";
  }
  return s;
}
export function createGame(mode = "revised", cards = shuffle(deck())) {
  if (!["classic", "revised"].includes(mode)) throw new Error("Unknown mode");
  const s = {
    mode,
    deck: structuredClone(cards),
    grid: Array.from({ length: 9 }, () => []),
    royals: Array(12).fill(null),
    ploys: [],
    spent: [],
    shame: [],
    queue: [],
    pending: null,
    stage: "setup",
    status: "playing",
    turns: 0,
    message: "Place the starting royals on a highlighted border slot.",
  };
  for (let i = 0; i < 9; i++) {
    if (mode === "classic" && i === 4) continue;
    while (!s.grid[i].length && s.deck.length) {
      const c = s.deck.shift();
      if (royal(c)) s.queue.push(c);
      else if (mode === "revised" && special(c)) s.ploys.push(c);
      else s.grid[i].push(c);
    }
  }
  setupNext(s);
  return s;
}
function setupNext(s) {
  s.pending = s.queue.shift() ?? null;
  if (!s.pending) {
    s.stage = s.mode === "revised" ? "mulligan" : "play";
    s.message =
      s.stage === "mulligan"
        ? "Optional: replace one grid card, or keep this deal."
        : "Ready. Draw your first card.";
  }
}
function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}
function spend(s, rank) {
  const index = s.ploys.findIndex((c) => c.rank === rank);
  requireThat(index !== -1, "That ploy is not available.");
  s.spent.push(...s.ploys.splice(index, 1));
}
// State transitions are atomic: an illegal action never mutates the caller's state.
export function act(state, action) {
  requireThat(state.status === "playing", "Start a new game to play again.");
  const s = structuredClone(state);
  const { type, index, from } = action;
  const gridIndex = (i) => Number.isInteger(i) && i >= 0 && i < 9;
  if (type === "keep" || type === "replace") {
    requireThat(s.stage === "mulligan", "The opening choice is over.");
    if (type === "replace") {
      requireThat(gridIndex(index), "Choose a grid card.");
      s.deck.push(...s.grid[index]);
      s.grid[index] = [];
      // Replacement specials join the stash; royals queue for placement, until a number fills the hole.
      while (!s.grid[index].length && s.deck.length) {
        const c = s.deck.shift();
        if (royal(c)) s.queue.push(c);
        else if (special(c)) s.ploys.push(c);
        else s.grid[index].push(c);
      }
      s.pending = s.queue.shift() ?? null;
      s.stage = s.pending ? "replacement" : "play";
    } else s.stage = "play";
    s.message = s.pending
      ? "Place the replacement royal."
      : "Opening complete. Draw a card.";
  } else if (type === "draw") {
    requireThat(
      s.stage === "play" && !s.pending && s.deck.length,
      "Resolve the current card first, or use a ploy.",
    );
    if (!s.royals.some((r) => r && !r.dead)) {
      const next = s.deck.findIndex(royal);
      requireThat(next >= 0, "No royal remains in the deck.");
      s.deck.push(...s.deck.splice(0, next));
    }
    s.pending = s.deck.shift();
    s.turns++;
    s.message = `Drawn ${label(s.pending)}. Choose a highlighted position.`;
    if (s.mode === "revised" && special(s.pending)) {
      s.ploys.push(s.pending);
      s.pending = null;
      s.message = "Ploy banked. Use it whenever you need it.";
    }
  } else if (type === "royal") {
    requireThat(
      royal(s.pending) && royalSlots(s).includes(index),
      "Royals must go beside their closest eligible match.",
    );
    s.royals[index] = {
      card: s.pending,
      armour: 0,
      armourCards: [],
      dead: false,
    };
    s.pending = null;
    s.message = "Royal deployed. Draw a card.";
    if (s.stage === "setup") setupNext(s);
    else if (s.stage === "replacement") {
      s.pending = s.queue.shift() ?? null;
      if (!s.pending) s.stage = "play";
    }
  } else if (type === "place") {
    requireThat(
      s.stage === "play" && placements(s).includes(index),
      "Place on an equal or lower card, or an empty space.",
    );
    const c = s.pending;
    if (s.mode === "classic" && special(c)) {
      s.deck.push(...s.grid[index]);
      s.grid[index] = [];
    }
    s.grid[index].push(c);
    s.pending = null;
    s.message = `Placed ${label(c)}. Draw when ready.`;
    attack(s, index);
  } else if (type === "extract") {
    requireThat(
      s.mode === "revised" &&
        s.stage === "play" &&
        gridIndex(index) &&
        s.grid[index].length,
      "Choose a nonempty stack during play.",
    );
    spend(s, 1);
    s.deck.push(...s.grid[index]);
    s.grid[index] = [];
    s.message = "Stack extracted to the bottom of the deck.";
  } else if (type === "move") {
    requireThat(
      s.mode === "revised" &&
        s.stage === "play" &&
        gridIndex(from) &&
        gridIndex(index) &&
        from !== index &&
        s.grid[from].length,
      "Choose different source and destination stacks.",
    );
    const c = top(s.grid[from]);
    requireThat(
      placements(s, c).includes(index),
      "Reassignment must land on an equal or lower card.",
    );
    spend(s, 0);
    s.grid[from].pop();
    s.grid[index].push(c);
    s.message = `Reassigned ${label(c)}.`;
    attack(s, index);
  } else if (type === "armour") {
    requireThat(
      armourSlots(s).includes(index),
      "Armour is only available for a blocked card and an eligible royal.",
    );
    const r = s.royals[index];
    r.armour += s.pending.rank;
    r.armourCards.push(s.pending);
    s.pending = null;
    s.message = `${label(r.card)} now has ${r.card.rank + r.armour} health.`;
  } else if (type === "reset") {
    requireThat(
      s.mode === "classic" &&
        s.stage === "play" &&
        s.pending &&
        !royal(s.pending) &&
        !placements(s).length &&
        gridIndex(index) &&
        s.grid[index].length,
      "Hard reset requires a blocked card and a nonempty stack.",
    );
    s.shame.push(s.pending);
    s.pending = null;
    s.deck.push(...s.grid[index]);
    s.grid[index] = [];
    s.message = "Hard reset. One card added to shame.";
  } else if (type === "refill") {
    requireThat(
      s.mode === "classic" &&
        s.stage === "play" &&
        !s.pending &&
        !s.deck.length &&
        gridIndex(index) &&
        s.grid[index].length,
      "Choose a stack after the deck runs out.",
    );
    s.shame.push(s.grid[index].pop());
    s.deck.push(...s.grid[index]);
    s.grid[index] = [];
    s.message = "Stack recycled. Its top card went to shame.";
  } else throw new Error("Unknown action");
  return settle(s);
}
