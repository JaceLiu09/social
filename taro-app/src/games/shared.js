export function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function sampleItems(list, count) {
  return shuffle(list).slice(0, count);
}

export function randomGameMatchDelayMs() {
  return 3000 + Math.floor(Math.random() * 12001);
}

export function mapRobotToGameOpponent(target, isBot = true) {
  return {
    id: target?.id || "",
    name: target?.nickname || target?.name || "隐藏款",
    avatar: target?.avatar || target?.avatarUrl || "",
    city: target?.city || target?.currentCity || "同城",
    gender: target?.gender || "FEMALE",
    isBot: Boolean(isBot)
  };
}

export function pickRandomItem(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback;
  return list[Math.floor(Math.random() * list.length)];
}
