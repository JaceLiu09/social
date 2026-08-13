import Taro from "@tarojs/taro";
import { requestJson } from "./api";

const AUDIO_MAX_BYTES = 8 * 1024 * 1024;

function readFileBase64(filePath, mimeType) {
  return new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: "base64",
      success: (res) => resolve(`data:${mimeType};base64,${res.data}`),
      fail: reject
    });
  });
}

function guessAudioMime(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".aac")) return "audio/mp4";
  return "audio/mpeg";
}

export async function uploadAudioFile(filePath, fileName = "voice.mp3", durationSec = 1) {
  const mimeType = guessAudioMime(filePath);
  const stat = await new Promise((resolve) => {
    Taro.getFileSystemManager().getFileInfo({
      filePath,
      success: resolve,
      fail: () => resolve(null)
    });
  });
  const size = stat?.size || 0;
  if (size > AUDIO_MAX_BYTES) throw new Error("语音过大，请控制在 8MB 内");

  const dataUrl = await readFileBase64(filePath, mimeType);
  const data = await requestJson("/chat/upload", {
    method: "POST",
    data: {
      fileName: String(fileName).replace(/[^\w.\-()+]/g, "_"),
      dataUrl,
      kind: "AUDIO",
      uploadCategory: "chat"
    }
  });
  const url = String(data.url || "").trim();
  if (!url) throw new Error("上传成功但未返回语音地址");
  return { url, durationSec: Math.max(1, Math.floor(Number(durationSec) || 1)) };
}

export function ensureRecordPermission() {
  return new Promise((resolve, reject) => {
    Taro.getSetting({
      success: (res) => {
        if (res.authSetting["scope.record"]) {
          resolve(true);
          return;
        }
        Taro.authorize({
          scope: "scope.record",
          success: () => resolve(true),
          fail: () => {
            Taro.showModal({
              title: "需要麦克风权限",
              content: "请在设置中允许录音权限以发送语音",
              confirmText: "去设置",
              success: (modal) => {
                if (modal.confirm) Taro.openSetting();
              }
            });
            reject(new Error("未授权录音权限"));
          }
        });
      },
      fail: reject
    });
  });
}

export function createVoiceRecorder({ onStart, onStop, onError }) {
  const recorder = Taro.getRecorderManager();
  let startedAt = 0;

  recorder.onStart(() => {
    startedAt = Date.now();
    onStart?.();
  });

  recorder.onStop(async (res) => {
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    onStop?.({ ...res, durationSec });
  });

  recorder.onError((err) => {
    onError?.(new Error(err.errMsg || "录音失败"));
  });

  return {
    start: async () => {
      await ensureRecordPermission();
      recorder.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: "mp3"
      });
    },
    stop: () => recorder.stop()
  };
}

const audioPlayers = new Map();

export function playVoice(url, messageId) {
  const src = String(url || "").trim();
  if (!src) return Promise.reject(new Error("语音地址无效"));

  audioPlayers.forEach((ctx, id) => {
    if (id !== messageId) {
      ctx.stop();
      audioPlayers.delete(id);
    }
  });

  const player = Taro.createInnerAudioContext();
  player.src = src;
  audioPlayers.set(messageId, player);

  return new Promise((resolve, reject) => {
    player.onEnded(() => {
      player.destroy();
      audioPlayers.delete(messageId);
      resolve();
    });
    player.onError((err) => {
      player.destroy();
      audioPlayers.delete(messageId);
      reject(new Error(err.errMsg || "播放失败"));
    });
    player.play();
  });
}

export function stopVoice(messageId) {
  const player = audioPlayers.get(messageId);
  if (!player) return;
  player.stop();
  player.destroy();
  audioPlayers.delete(messageId);
}
