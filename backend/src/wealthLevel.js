/** 财富等级：按累计消费贡献积分划分，参考陌陌财富体系 */
export const WEALTH_LEVEL_META = [
  { level: 0, name: "初识", minPoints: 0 },
  { level: 1, name: "青铜", minPoints: 100 },
  { level: 2, name: "青铜II", minPoints: 600 },
  { level: 3, name: "白银", minPoints: 3000 },
  { level: 4, name: "白银II", minPoints: 9800 },
  { level: 5, name: "黄金", minPoints: 29800 },
  { level: 6, name: "黄金II", minPoints: 59800 },
  { level: 7, name: "铂金", minPoints: 99800 },
  { level: 8, name: "铂金II", minPoints: 199800 },
  { level: 9, name: "钻石", minPoints: 299800 },
  { level: 10, name: "钻石II", minPoints: 499800 },
  { level: 11, name: "星耀", minPoints: 999800 },
  { level: 12, name: "星耀II", minPoints: 1999800 },
  { level: 13, name: "王者", minPoints: 4999800 },
  { level: 14, name: "王者II", minPoints: 9999800 },
  { level: 15, name: "荣耀", minPoints: 19999800 }
];

export function computeWealthLevel(contributionPoints) {
  const amount = Number(contributionPoints) || 0;
  let level = 0;
  let name = WEALTH_LEVEL_META[0].name;
  for (const tier of WEALTH_LEVEL_META) {
    if (amount >= tier.minPoints) {
      level = tier.level;
      name = tier.name;
    }
  }
  return { wealthLevel: level, wealthLevelName: name };
}

export function walletSnapshot(user) {
  const { wealthLevel, wealthLevelName } = computeWealthLevel(user?.contributionPoints);
  return {
    coinBalance: user?.coinBalance ?? 0,
    totalCoinRecharged: user?.totalCoinRecharged ?? 0,
    totalCoinSpent: user?.totalCoinSpent ?? 0,
    contributionPoints: user?.contributionPoints ?? 0,
    charmValue: user?.charmValue ?? 0,
    wealthLevel: user?.wealthLevel ?? wealthLevel,
    wealthLevelName
  };
}
