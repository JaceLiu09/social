import { useState } from "react";
import { View, Text, Textarea, Button, Image } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { ensureLoggedIn } from "../../services/auth";
import { publishSquarePost } from "../../services/profile";
import { chooseAndUploadImage } from "../../services/upload";
import { resolveAvatarUrl } from "../../utils/media";
import "./index.scss";

export default function MeComposePage() {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    if (!ensureLoggedIn()) return;
  });

  const addImages = async () => {
    try {
      const uploaded = await chooseAndUploadImage(Math.min(9 - images.length, 3), "SQUARE");
      setImages((prev) => [...prev, ...uploaded.map((u) => u.url)].slice(0, 9));
    } catch (error) {
      Taro.showToast({ title: error.message || "上传失败", icon: "none" });
    }
  };

  const publish = async () => {
    if (!text.trim() && !images.length) {
      Taro.showToast({ title: "写点内容或选图片", icon: "none" });
      return;
    }
    setLoading(true);
    try {
      await publishSquarePost(text.trim(), images);
      Taro.showToast({ title: "发布成功", icon: "success" });
      setTimeout(() => Taro.switchTab({ url: "/pages/square/index" }), 500);
    } catch (error) {
      Taro.showToast({ title: error.message || "发布失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="compose-page">
      <Textarea
        className="compose-text"
        placeholder="分享此刻…"
        maxlength={500}
        value={text}
        onInput={(e) => setText(e.detail.value)}
      />
      <View className="compose-images">
        {images.map((url, i) => (
          <Image key={`${url}-${i}`} className="compose-image" mode="aspectFill" src={resolveAvatarUrl(url)} />
        ))}
        {images.length < 9 ? <View className="compose-image add" onClick={addImages}>+</View> : null}
      </View>
      <Button className="primary-btn" loading={loading} onClick={publish}>发布到广场</Button>
    </View>
  );
}
