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

/** 基础兑换：1 元 = 5 盲盒币（参考 Soul 币比例） */
export const COIN_YUAN_RATE = 5;

/**
 * 盲盒币充值档位：price 为人民币（元），coins 为到账盲盒币，bonus 为赠送币（展示用）
 */
export const COIN_PACKAGES = [
  { id: "pkg_5", coins: 5, price: 1, bonus: 0 },
  { id: "pkg_60", coins: 60, price: 12, bonus: 0 },
  { id: "pkg_169", coins: 169, price: 30, bonus: 19 },
  { id: "pkg_273", coins: 273, price: 48, bonus: 33 },
  { id: "pkg_585", coins: 585, price: 98, bonus: 95 },
  { id: "pkg_1070", coins: 1070, price: 178, bonus: 180 },
  { id: "pkg_2421", coins: 2421, price: 388, bonus: 481 },
  { id: "pkg_3658", coins: 3658, price: 588, bonus: 718 },
  { id: "pkg_5322", coins: 5322, price: 798, bonus: 1332 }
];

/** 默认礼物库（首次启动写入；启动时按 sortOrder 同步价格） */
export const DEFAULT_GIFTS = [
  { name: "向日葵", icon: "🌻", coinPrice: 6, badge: null, sortOrder: 1 },
  { name: "比心", icon: "💖", coinPrice: 6, badge: "NEW", sortOrder: 2 },
  { name: "小雪兔", icon: "🐰", coinPrice: 18, badge: null, sortOrder: 3 },
  { name: "浪漫玫瑰", icon: "🌹", coinPrice: 21, badge: null, sortOrder: 4 },
  { name: "心动信号", icon: "💫", coinPrice: 52, badge: "520", sortOrder: 5 },
  { name: "好柿花生", icon: "🥜", coinPrice: 55, badge: null, sortOrder: 6 },
  { name: "全城告白", icon: "💌", coinPrice: 52, badge: "告白", sortOrder: 7 },
  { name: "甜蜜奶茶", icon: "🧋", coinPrice: 18, badge: null, sortOrder: 8 },
  { name: "雪兔礼盒", icon: "🎁", coinPrice: 520, badge: "HOT", sortOrder: 9 },
  { name: "梦幻飞行", icon: "✈️", coinPrice: 999, badge: null, sortOrder: 10 },
  { name: "真爱之戒", icon: "💍", coinPrice: 1999, badge: null, sortOrder: 11 },
  { name: "梦幻城堡", icon: "🏰", coinPrice: 5200, badge: null, sortOrder: 12 }
];
