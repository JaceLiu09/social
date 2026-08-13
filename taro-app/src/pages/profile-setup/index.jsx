import { useState } from "react";
import { View, Text, Input, Button, Picker, Image } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { completeProfile, ensureLoggedIn, getCurrentUser } from "../../services/auth";
import { chooseAndUploadImage } from "../../services/upload";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

const GENDERS = [
  { label: "男", value: "MALE" },
  { label: "女", value: "FEMALE" }
];

export default function ProfileSetupPage() {
  const user = getCurrentUser();
  const [form, setForm] = useState({
    nickname: user?.nickname || "",
    gender: "MALE",
    birthDate: "2000-01-01",
    hometown: "",
    currentCity: "",
    income: "",
    industry: "",
    hobbies: "",
    partnerExpectation: ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useLoad(() => {
    if (!ensureLoggedIn()) return;
  });

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const uploadAvatar = async () => {
    try {
      const uploaded = await chooseAndUploadImage(1, "PROFILE");
      if (uploaded[0]?.url) setAvatarUrl(uploaded[0].url);
    } catch (error) {
      Taro.showToast({ title: error.message || "上传失败", icon: "none" });
    }
  };

  const onSubmit = async () => {
    if (!form.nickname.trim()) {
      setMessage("请填写昵称");
      return;
    }
    if (!form.hometown.trim() || !form.currentCity.trim()) {
      setMessage("请填写家乡和现居城市");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await completeProfile({ ...form, avatarUrl: avatarUrl || undefined });
      Taro.showToast({ title: "资料已完善", icon: "success" });
      setTimeout(() => Taro.switchTab({ url: "/pages/planet/index" }), 500);
    } catch (error) {
      setMessage(error.message || "保存失败");
    } finally {
      setLoading(false);
    }
  };

  const genderIndex = Math.max(0, GENDERS.findIndex((g) => g.value === form.gender));

  return (
    <View className="profile-setup">
      <Text className="profile-setup-title">完善资料</Text>
      <Text className="profile-setup-sub">完成后即可开始匹配与聊天</Text>

      <View className="profile-avatar-row" onClick={uploadAvatar}>
        {avatarUrl ? (
          <Image className="profile-avatar" mode="aspectFill" src={resolveAvatarUrl(avatarUrl)} />
        ) : (
          <View className="profile-avatar profile-avatar--empty">上传头像</View>
        )}
      </View>

      <View className="profile-field">
        <Text className="profile-label">昵称</Text>
        <Input className="profile-input" value={form.nickname} onInput={(e) => setField("nickname", e.detail.value)} />
      </View>

      <View className="profile-field">
        <Text className="profile-label">性别</Text>
        <Picker
          mode="selector"
          range={GENDERS.map((g) => g.label)}
          value={genderIndex}
          onChange={(e) => setField("gender", GENDERS[Number(e.detail.value)]?.value || "MALE")}
        >
          <View className="profile-picker">{GENDERS[genderIndex]?.label || "男"}</View>
        </Picker>
      </View>

      <View className="profile-field">
        <Text className="profile-label">出生日期</Text>
        <Picker mode="date" value={form.birthDate} onChange={(e) => setField("birthDate", e.detail.value)}>
          <View className="profile-picker">{form.birthDate}</View>
        </Picker>
      </View>

      {[
        ["hometown", "家乡"],
        ["currentCity", "现居城市"],
        ["income", "收入"],
        ["industry", "行业"],
        ["hobbies", "爱好"],
        ["partnerExpectation", "择偶期待"]
      ].map(([key, label]) => (
        <View key={key} className="profile-field">
          <Text className="profile-label">{label}</Text>
          <Input className="profile-input" value={form[key]} onInput={(e) => setField(key, e.detail.value)} />
        </View>
      ))}

      {message ? <Text className="profile-msg">{message}</Text> : null}
      <Button className="profile-submit primary-btn" loading={loading} onClick={onSubmit}>
        保存并进入
      </Button>
    </View>
  );
}
