import { useState } from "react";
import { View, Text, Input, Button, Image } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { ensureLoggedIn, getCurrentUser, patchProfile } from "../../services/auth";
import { chooseAndUploadImage } from "../../services/upload";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function MeEditPage() {
  const user = getCurrentUser();
  const [form, setForm] = useState({
    nickname: user?.nickname || "",
    currentCity: user?.currentCity || "",
    hometown: user?.hometown || "",
    hobbies: user?.hobbies || "",
    partnerExpectation: user?.partnerExpectation || ""
  });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
    let urls = [];
    try {
      urls = user?.photoUrls ? JSON.parse(user.photoUrls) : [];
    } catch (_e) {
      urls = Array.isArray(user?.photoUrls) ? user.photoUrls : [];
    }
    setPhotos(Array.isArray(urls) ? urls.filter(Boolean) : []);
  });

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const addPhoto = async () => {
    try {
      const uploaded = await chooseAndUploadImage(1, "PROFILE");
      if (uploaded[0]?.url) setPhotos((p) => [...p, uploaded[0].url].slice(0, 6));
    } catch (error) {
      Taro.showToast({ title: error.message || "上传失败", icon: "none" });
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      const slots = [...photos];
      while (slots.length < 6) slots.push("");
      await patchProfile({ ...form, photoUrls: slots, avatarUrl: photos[0] || user?.avatarUrl || null });
      Taro.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => Taro.navigateBack(), 500);
    } catch (error) {
      Taro.showToast({ title: error.message || "保存失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="edit-page">
      <Text className="section-title">编辑资料</Text>
      <View className="edit-photos">
        {photos.map((url, i) => (
          <Image key={`${url}-${i}`} className="edit-photo" mode="aspectFill" src={resolveAvatarUrl(url)} />
        ))}
        {photos.length < 6 ? <View className="edit-photo add" onClick={addPhoto}>+</View> : null}
      </View>
      {[
        ["nickname", "昵称"],
        ["currentCity", "现居城市"],
        ["hometown", "家乡"],
        ["hobbies", "爱好"],
        ["partnerExpectation", "择偶期待"]
      ].map(([key, label]) => (
        <View key={key} className="edit-field">
          <Text className="edit-label">{label}</Text>
          <Input className="edit-input" value={form[key]} onInput={(e) => setField(key, e.detail.value)} />
        </View>
      ))}
      <Button className="primary-btn" loading={loading} onClick={save}>保存</Button>
    </View>
  );
}
