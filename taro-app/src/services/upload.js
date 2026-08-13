import Taro from "@tarojs/taro";
import { requestJson } from "./api";

function readFileBase64(filePath) {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: "base64",
      success: (res) => resolve(`data:image/jpeg;base64,${res.data}`),
      fail: reject
    });
  });
}

export async function uploadImageFile(filePath, fileName = "photo.jpg", uploadCategory = "CHAT") {
  const dataUrl = await readFileBase64(filePath);
  const data = await requestJson("/chat/upload", {
    method: "POST",
    data: {
      fileName: String(fileName).replace(/[^\w.\-()+]/g, "_"),
      dataUrl,
      kind: "IMAGE",
      uploadCategory
    }
  });
  const url = String(data.url || "").trim();
  if (!url) throw new Error("上传成功但未返回地址");
  return { url, thumbUrl: String(data.thumbUrl || url).trim() || url };
}

export async function chooseAndUploadImage(count = 1, uploadCategory = "CHAT") {
  const picked = await Taro.chooseImage({ count, sizeType: ["compressed"], sourceType: ["album", "camera"] });
  const paths = picked.tempFilePaths || [];
  const results = [];
  for (let i = 0; i < paths.length; i += 1) {
    Taro.showLoading({ title: `上传 ${i + 1}/${paths.length}`, mask: true });
    try {
      results.push(await uploadImageFile(paths[i], `img-${Date.now()}-${i}.jpg`, uploadCategory));
    } finally {
      Taro.hideLoading();
    }
  }
  return results;
}
