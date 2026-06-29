import { CHARM_RATIO, POINTS_PER_COIN, POINT_MEMBERSHIP_REDEEM } from "./config.js";
import { computeWealthLevel, walletSnapshot } from "./wealthLevel.js";

export async function recordCoinLedger(tx, userId, delta, balance, reason, refId = null) {
  return tx.coinLedger.create({
    data: { userId, delta, balance, reason, refId }
  });
}

export async function recordPointLedger(tx, userId, pointType, delta, balance, reason, refId = null) {
  return tx.pointLedger.create({
    data: { userId, pointType, delta, balance, reason, refId }
  });
}

export async function applyWealthLevelFromPoints(tx, userId, contributionPoints) {
  const { wealthLevel } = computeWealthLevel(contributionPoints);
  return tx.user.update({
    where: { id: userId },
    data: { wealthLevel }
  });
}

/** 消费盲盒币：扣余额、累计消费、加贡献积分、写流水、刷新财富等级 */
export async function applyCoinSpend(tx, userId, coinAmount, reason, refId = null) {
  const amount = Math.max(0, Math.floor(Number(coinAmount) || 0));
  if (amount <= 0) throw new Error("消费金额无效");

  const sender = await tx.user.findUnique({ where: { id: userId } });
  if (!sender) throw new Error("用户不存在");
  if ((sender.coinBalance || 0) < amount) {
    throw new Error("盲盒币不足，请先充值");
  }

  const nextBalance = (sender.coinBalance || 0) - amount;
  const pointsEarned = amount * POINTS_PER_COIN;
  const nextSpent = (sender.totalCoinSpent || 0) + amount;
  const nextContribution = (sender.contributionPoints || 0) + pointsEarned;

  await tx.user.update({
    where: { id: userId },
    data: {
      coinBalance: nextBalance,
      totalCoinSpent: nextSpent,
      contributionPoints: nextContribution
    }
  });

  await recordCoinLedger(tx, userId, -amount, nextBalance, reason, refId);
  await recordPointLedger(tx, userId, "CONTRIBUTION", pointsEarned, nextContribution, reason, refId);

  const userWithLevel = await applyWealthLevelFromPoints(tx, userId, nextContribution);
  return { user: userWithLevel, pointsEarned, wallet: walletSnapshot(userWithLevel) };
}

/** 收礼方增加魅力值 */
export async function applyCharmGain(tx, userId, coinAmount, refId = null) {
  const charmEarned = Math.floor(Math.max(0, Number(coinAmount) || 0) * CHARM_RATIO);
  if (charmEarned <= 0) return null;

  const receiver = await tx.user.findUnique({ where: { id: userId } });
  if (!receiver) return null;

  const nextCharm = (receiver.charmValue || 0) + charmEarned;
  const updated = await tx.user.update({
    where: { id: userId },
    data: { charmValue: nextCharm }
  });

  await recordPointLedger(tx, userId, "CHARM", charmEarned, nextCharm, "GIFT_RECEIVE", refId);
  return updated;
}

export function findPointMembershipRedeem(redeemId) {
  return POINT_MEMBERSHIP_REDEEM.find((item) => item.id === String(redeemId || "").trim()) || null;
}

function extendMembershipExpire(currentExpireAt, days) {
  const now = new Date();
  const base =
    currentExpireAt && new Date(currentExpireAt).getTime() > now.getTime()
      ? new Date(currentExpireAt)
      : now;
  base.setDate(base.getDate() + days);
  return base;
}

/** 积分兑换会员天数 */
export async function redeemPointsMembership(tx, userId, redeemId) {
  const option = findPointMembershipRedeem(redeemId);
  if (!option) throw new Error("兑换档位无效");

  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("用户不存在");
  if ((user.contributionPoints || 0) < option.costPoints) {
    throw new Error(`贡献积分不足，需要 ${option.costPoints} 积分`);
  }

  const nextPoints = (user.contributionPoints || 0) - option.costPoints;
  const expire = extendMembershipExpire(user.membershipExpireAt, option.days);
  const nextMembershipType =
    user.membershipType === "FREE" || !user.membershipExpireAt ? "MONTH" : user.membershipType;

  const updated = await tx.user.update({
    where: { id: userId },
    data: {
      contributionPoints: nextPoints,
      membershipType: nextMembershipType,
      membershipExpireAt: expire
    }
  });

  await recordPointLedger(
    tx,
    userId,
    "CONTRIBUTION",
    -option.costPoints,
    nextPoints,
    "MEMBERSHIP_REDEEM",
    option.id
  );

  const userWithLevel = await applyWealthLevelFromPoints(tx, userId, nextPoints);
  return {
    user: userWithLevel,
    redeem: option,
    membershipExpireAt: expire,
    wallet: walletSnapshot(userWithLevel)
  };
}

/** 充值到账：加盲盒币并记流水（不增加财富等级，等级由消费积分决定） */
export async function applyCoinRecharge(tx, userId, coins, amount, orderId) {
  const currentUser = await tx.user.findUnique({ where: { id: userId } });
  if (!currentUser) throw new Error("用户不存在");

  const nextBalance = (currentUser.coinBalance || 0) + coins;
  const nextRecharged = (currentUser.totalCoinRecharged || 0) + amount;

  const updated = await tx.user.update({
    where: { id: userId },
    data: {
      coinBalance: nextBalance,
      totalCoinRecharged: nextRecharged
    }
  });

  await recordCoinLedger(tx, userId, coins, nextBalance, "RECHARGE", orderId);
  return { user: updated, wallet: walletSnapshot(updated) };
}
