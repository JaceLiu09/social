/** 月收入区间（与后台 Fake 机器人表单一致） */
export const INCOME_OPTIONS = ["3000以下", "3000-5000", "5000-1万", "1万-2万", "2万以上"];

const LEGACY_INCOME_MAP = {
  "5-6k": "5000-1万",
  "6k-10k": "5000-1万",
  "8k-15k": "1万-2万",
  "10k-20k": "1万-2万",
  "12k-18k": "1万-2万",
  "15k-25k": "2万以上",
  "5万以上": "2万以上",
  "10k以上": "2万以上",
  "20k以上": "2万以上"
};

function bucketFromMonthlyYuan(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "5000-1万";
  if (n < 3000) return "3000以下";
  if (n < 5000) return "3000-5000";
  if (n < 10000) return "5000-1万";
  if (n < 20000) return "1万-2万";
  return "2万以上";
}

function parseKAmount(part) {
  const s = String(part || "")
    .trim()
    .toLowerCase()
    .replace(/,/g, "");
  if (!s) return null;
  const wan = s.match(/^([\d.]+)\s*万\+?$/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  const wanPlus = s.match(/^([\d.]+)\s*万\s*以上$/);
  if (wanPlus) return Math.round(parseFloat(wanPlus[1]) * 10000);
  const k = s.match(/^([\d.]+)\s*k\+?$/i);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  const kPlus = s.match(/^([\d.]+)\s*k\s*以上$/i);
  if (kPlus) return Math.round(parseFloat(kPlus[1]) * 1000);
  const plain = s.match(/^([\d.]+)$/);
  if (plain) {
    const n = parseFloat(plain[1]);
    if (n < 100) return Math.round(n * 1000);
    return Math.round(n);
  }
  return null;
}

function parseIncomeMidpoint(raw) {
  let text = String(raw || "").trim().toLowerCase().replace(/\s/g, "");
  text = text.replace(/^收入[:：]?/, "");
  if (!text) return null;

  const rangeYuan = text.match(/^([\d.]+)[-~～至到]([\d.]+)$/);
  if (rangeYuan) {
    const left = parseFloat(rangeYuan[1]);
    const right = parseFloat(rangeYuan[2]);
    if (Number.isFinite(left) && Number.isFinite(right)) {
      const a = left < 100 ? left * 1000 : left;
      const b = right < 100 ? right * 1000 : right;
      return (a + b) / 2;
    }
  }

  const rangeK = text.match(/^([\d.-]+)k[-~～至到]([\d.-]+)k$/i);
  if (rangeK) {
    return (parseKAmount(`${rangeK[1]}k`) + parseKAmount(`${rangeK[2]}k`)) / 2;
  }

  const dashK = text.match(/^([\d.-]+)[-~～至到]([\d.]+)k$/i);
  if (dashK) {
    const left = parseKAmount(dashK[1].includes("k") ? dashK[1] : `${dashK[1]}k`);
    const right = parseKAmount(`${dashK[2]}k`);
    if (left != null && right != null) return (left + right) / 2;
  }

  const rangePlainK = text.match(/^([\d.]+)[-~～至到]([\d.]+)k$/i);
  if (rangePlainK) {
    const left = parseKAmount(`${rangePlainK[1]}k`);
    const right = parseKAmount(`${rangePlainK[2]}k`);
    if (left != null && right != null) return (left + right) / 2;
  }

  const aboveK = text.match(/^([\d.]+)k以上$/i);
  if (aboveK) return parseKAmount(`${aboveK[1]}k`) + 5000;

  const aboveWan = text.match(/^([\d.]+)万以上$/);
  if (aboveWan) return parseKAmount(`${aboveWan[1]}万`) + 5000;

  const singleK = text.match(/^([\d.]+)k$/i);
  if (singleK) return parseKAmount(`${singleK[1]}k`);

  if (text.includes("以下")) {
    const n = parseKAmount(text.replace("以下", ""));
    if (n != null) return Math.max(0, n - 500);
  }

  const wanRange = text.match(/^([\d.]+)万[-~～至到]([\d.]+)万$/);
  if (wanRange) {
    return (parseKAmount(`${wanRange[1]}万`) + parseKAmount(`${wanRange[2]}万`)) / 2;
  }

  return null;
}

/** 将任意旧收入文案归一化为标准区间 */
export function normalizeIncomeRange(raw) {
  const s = String(raw || "").trim();
  if (!s) return "5000-1万";
  if (INCOME_OPTIONS.includes(s)) return s;

  const legacyKey = s.toLowerCase().replace(/\s/g, "");
  for (const [key, value] of Object.entries(LEGACY_INCOME_MAP)) {
    if (key.toLowerCase().replace(/\s/g, "") === legacyKey) return value;
  }

  const midpoint = parseIncomeMidpoint(s);
  if (midpoint != null) return bucketFromMonthlyYuan(midpoint);

  return "5000-1万";
}

export function isStandardIncomeRange(value) {
  return INCOME_OPTIONS.includes(String(value || "").trim());
}
