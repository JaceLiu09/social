/** 财富等级：按累计充值金额（元）划分，参考陌陌财富体系 */
export const WEALTH_LEVEL_META = [
  { level: 0, name: "初识", minRecharge: 0 },
  { level: 1, name: "青铜", minRecharge: 1 },
  { level: 2, name: "青铜II", minRecharge: 6 },
  { level: 3, name: "白银", minRecharge: 30 },
  { level: 4, name: "白银II", minRecharge: 98 },
  { level: 5, name: "黄金", minRecharge: 298 },
  { level: 6, name: "黄金II", minRecharge: 598 },
  { level: 7, name: "铂金", minRecharge: 998 },
  { level: 8, name: "铂金II", minRecharge: 1998 },
  { level: 9, name: "钻石", minRecharge: 2998 },
  { level: 10, name: "钻石II", minRecharge: 4998 },
  { level: 11, name: "星耀", minRecharge: 9998 },
  { level: 12, name: "星耀II", minRecharge: 19998 },
  { level: 13, name: "王者", minRecharge: 49998 },
  { level: 14, name: "王者II", minRecharge: 99998 },
  { level: 15, name: "荣耀", minRecharge: 199998 }
];

export function computeWealthLevel(totalCoinRecharged) {
  const amount = Number(totalCoinRecharged) || 0;
  let level = 0;
  let name = WEALTH_LEVEL_META[0].name;
  for (const tier of WEALTH_LEVEL_META) {
    if (amount >= tier.minRecharge) {
      level = tier.level;
      name = tier.name;
    }
  }
  return { wealthLevel: level, wealthLevelName: name };
}

export function walletSnapshot(user) {
  const { wealthLevel, wealthLevelName } = computeWealthLevel(user?.totalCoinRecharged);
  return {
    coinBalance: user?.coinBalance ?? 0,
    totalCoinRecharged: user?.totalCoinRecharged ?? 0,
    wealthLevel: user?.wealthLevel ?? wealthLevel,
    wealthLevelName
  };
}
