export const MEMBERSHIP_PRICE = {
  MONTH: 49,
  QUARTER: 129,
  HALF_YEAR: 199,
  YEAR: 359
};

export const MALE_UNLOCK_FEE = 1.9;
export const FRIENDLINESS_PER_ROUND = 10;
export const MIN_ROUNDS_FOR_UNLOCK = 5;

/** 消费盲盒币 → 贡献积分比例 */
export const POINTS_PER_COIN = 1;

/** 收礼方魅力值 = 礼物盲盒币 × 该比例（向下取整） */
export const CHARM_RATIO = 0.5;

/** 积分兑换会员档位 */
export const POINT_MEMBERSHIP_REDEEM = [
  { id: "redeem_7d", days: 7, costPoints: 500, label: "7天体验会员" },
  { id: "redeem_30d", days: 30, costPoints: 2000, label: "30天会员" }
];

/** 盲盒币充值档位：price 为人民币（元），coins 为到账盲盒币 */
export const COIN_PACKAGES = [
  { id: "pkg_60", coins: 60, price: 6 },
  { id: "pkg_300", coins: 300, price: 30 },
  { id: "pkg_980", coins: 980, price: 98 },
  { id: "pkg_2980", coins: 2980, price: 298 },
  { id: "pkg_6480", coins: 6480, price: 648 },
  { id: "pkg_12980", coins: 12980, price: 1298 }
];

/** 默认礼物库（首次启动写入数据库） */
export const DEFAULT_GIFTS = [
  { name: "向日葵", icon: "🌻", coinPrice: 99, badge: null, sortOrder: 1 },
  { name: "比心", icon: "💖", coinPrice: 199, badge: "NEW", sortOrder: 2 },
  { name: "雪兔", icon: "🐰", coinPrice: 520, badge: null, sortOrder: 3 },
  { name: "浪漫玫瑰", icon: "🌹", coinPrice: 666, badge: null, sortOrder: 4 },
  { name: "梦幻飞行", icon: "✈️", coinPrice: 1499, badge: "HOT", sortOrder: 5 },
  { name: "全城告白", icon: "💌", coinPrice: 1500, badge: null, sortOrder: 6 },
  { name: "真爱之戒", icon: "💍", coinPrice: 1999, badge: null, sortOrder: 7 },
  { name: "童星传递", icon: "⭐", coinPrice: 2999, badge: "HOT", sortOrder: 8 },
  { name: "海洋之心", icon: "💎", coinPrice: 5200, badge: null, sortOrder: 9 },
  { name: "独角兽", icon: "🦄", coinPrice: 8888, badge: null, sortOrder: 10 },
  { name: "超级跑车", icon: "🏎️", coinPrice: 9999, badge: null, sortOrder: 11 },
  { name: "梦幻城堡", icon: "🏰", coinPrice: 19999, badge: null, sortOrder: 12 }
];
