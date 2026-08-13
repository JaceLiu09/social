function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatChatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDistanceKm(km) {
  if (km == null || !Number.isFinite(Number(km))) return "";
  const n = Number(km);
  if (n < 1) return "<1km";
  return `${Math.round(n)}km`;
}

export function formatGender(gender) {
  if (gender === "MALE") return "男";
  if (gender === "FEMALE") return "女";
  return "";
}
