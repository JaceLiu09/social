import { useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { PRIVACY_POLICY_DOC, USER_AGREEMENT_DOC } from "../../constants/legal";
import "./index.scss";

export default function LegalPage() {
  const [doc, setDoc] = useState(null);

  useLoad((query) => {
    const type = String(query.type || "privacy");
    const selected = type === "agreement" ? USER_AGREEMENT_DOC : PRIVACY_POLICY_DOC;
    setDoc(selected);
    Taro.setNavigationBarTitle({ title: selected.title });
  });

  if (!doc) return <View className="legal-page" />;

  return (
    <ScrollView className="legal-page" scrollY>
      <Text className="legal-title">{doc.title}</Text>
      <Text className="legal-meta">更新：{doc.updatedAt} · 生效：{doc.effectiveAt}</Text>
      {doc.sections.map((section, idx) => (
        <View key={idx} className="legal-section">
          <Text className="legal-heading">{section.heading}</Text>
          {(section.paragraphs || []).map((p, i) => (
            <Text key={`p-${i}`} className="legal-p">{p}</Text>
          ))}
          {(section.list || []).map((item, i) => (
            <Text key={`l-${i}`} className="legal-li">· {item.replace(/\*\*/g, "")}</Text>
          ))}
          {(section.paragraphsAfter || []).map((p, i) => (
            <Text key={`pa-${i}`} className="legal-p">{p}</Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
