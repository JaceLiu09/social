import { useState } from "react";
import { View, Text, Button, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { ensureLoggedIn } from "../../services/auth";
import { fetchWallet, fetchCoinPackages, fetchCoinLedger, createCoinOrder, payCoinOrder, createMembershipOrder, payMembershipOrder, fetchMembershipRedeemOptions, redeemMembership } from "../../services/wallet";
import "./index.scss";

const PLANS = [
  { id: "MONTH", label: "1个月 VIP", price: 49 },
  { id: "QUARTER", label: "3个月 VIP", price: 129 },
  { id: "YEAR", label: "12个月 VIP", price: 359 }
];

export default function MeWalletPage() {
  const [wallet, setWallet] = useState(null);
  const [packages, setPackages] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [redeemOptions, setRedeemOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    loadData();
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [w, p, l, r] = await Promise.all([
        fetchWallet(),
        fetchCoinPackages().catch(() => ({ packages: [] })),
        fetchCoinLedger().catch(() => ({ ledger: [] })),
        fetchMembershipRedeemOptions().catch(() => ({ options: [] }))
      ]);
      setWallet(w.wallet);
      setPackages(Array.isArray(p.packages) ? p.packages : []);
      setLedger(Array.isArray(l.ledger) ? l.ledger : []);
      setRedeemOptions(Array.isArray(r.options) ? r.options : []);
    } finally {
      setLoading(false);
    }
  };

  const recharge = async (packageId) => {
    try {
      Taro.showLoading({ title: "发起支付…", mask: true });
      const order = await createCoinOrder(packageId);
      const orderId = order.order?.id || order.id;
      await payCoinOrder(orderId);
      Taro.showToast({ title: "充值成功", icon: "success" });
      loadData();
    } catch (error) {
      Taro.showToast({ title: error.message || "充值失败", icon: "none" });
    } finally {
      Taro.hideLoading();
    }
  };

  const buyVip = async (planType) => {
    try {
      Taro.showLoading({ title: "发起支付…", mask: true });
      const order = await createMembershipOrder(planType);
      const orderId = order.order?.id || order.id;
      await payMembershipOrder(orderId);
      Taro.showToast({ title: "开通成功", icon: "success" });
      loadData();
    } catch (error) {
      Taro.showToast({ title: error.message || "开通失败", icon: "none" });
    } finally {
      Taro.hideLoading();
    }
  };

  const redeemVip = async (redeemId) => {
    try {
      await redeemMembership(redeemId);
      Taro.showToast({ title: "兑换成功", icon: "success" });
      loadData();
    } catch (error) {
      Taro.showToast({ title: error.message || "兑换失败", icon: "none" });
    }
  };

  return (
    <ScrollView className="wallet-page" scrollY>
      <View className="wallet-card">
        <Text className="wallet-title">我的钱包</Text>
        <View className="wallet-stats">
          <View className="wallet-stat"><Text className="wallet-num">{wallet?.coinBalance ?? 0}</Text><Text>金币</Text></View>
          <View className="wallet-stat"><Text className="wallet-num">{wallet?.charmValue ?? 0}</Text><Text>魅力</Text></View>
          <View className="wallet-stat"><Text className="wallet-num">{wallet?.contributionPoints ?? 0}</Text><Text>贡献</Text></View>
        </View>
        <Text className="wallet-meta">会员：{wallet?.membershipType || "普通"} · 财富 Lv.{wallet?.wealthLevel ?? 0}</Text>
      </View>

      <View className="wallet-section">
        <Text className="section-title">金币充值</Text>
        {packages.map((pkg) => (
          <View key={pkg.id} className="wallet-row" onClick={() => recharge(pkg.id)}>
            <Text>{pkg.label || pkg.name}</Text>
            <Text>{pkg.price ?? pkg.coinAmount} 元</Text>
          </View>
        ))}
      </View>

      <View className="wallet-section">
        <Text className="section-title">开通 VIP</Text>
        {PLANS.map((plan) => (
          <View key={plan.id} className="wallet-row" onClick={() => buyVip(plan.id)}>
            <Text>{plan.label}</Text>
            <Text>¥{plan.price}</Text>
          </View>
        ))}
      </View>

      {redeemOptions.length ? (
        <View className="wallet-section">
          <Text className="section-title">积分兑换会员</Text>
          {redeemOptions.map((opt) => (
            <View key={opt.id} className="wallet-row" onClick={() => redeemVip(opt.id)}>
              <Text>{opt.label || opt.name}</Text>
              <Text>{opt.pointsCost} 贡献点</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="wallet-section">
        <Text className="section-title">金币流水</Text>
        {loading ? <Text className="muted-text">加载中…</Text> : null}
        {ledger.map((row) => (
          <View key={row.id} className="wallet-row">
            <Text>{row.reason || row.description || "交易"}</Text>
            <Text>{row.amount > 0 ? `+${row.amount}` : row.amount}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
