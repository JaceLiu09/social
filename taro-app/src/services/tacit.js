import { requestJson } from "./api";

export async function enqueueTacitMatch(topicCategory) {
  return requestJson("/tacit/match/enqueue", {
    method: "POST",
    data: { topicCategory }
  });
}

export function fetchTacitMatchStatus() {
  return requestJson("/tacit/match/status");
}

export async function cancelTacitMatch() {
  return requestJson("/tacit/match/cancel", { method: "POST" });
}

export async function resetTacitSession() {
  return requestJson("/tacit/session/reset", { method: "POST" });
}

export async function createTacitRoom(topicCategory) {
  return requestJson("/tacit/rooms", {
    method: "POST",
    data: { topicCategory }
  });
}

export function fetchTacitRoom(roomId) {
  return requestJson(`/tacit/rooms/${encodeURIComponent(roomId)}`);
}

export function fetchTacitInvitations() {
  return requestJson("/tacit/invitations");
}

export async function inviteToTacitRoom(roomId, toUserId) {
  return requestJson(`/tacit/rooms/${encodeURIComponent(roomId)}/invite`, {
    method: "POST",
    data: { toUserId }
  });
}

export async function respondTacitInvite(roomId, accept) {
  return requestJson(`/tacit/rooms/${encodeURIComponent(roomId)}/respond`, {
    method: "POST",
    data: { accept }
  });
}

export async function startTacitRoom(roomId) {
  return requestJson(`/tacit/rooms/${encodeURIComponent(roomId)}/start`, { method: "POST" });
}

export async function answerTacitQuestion(roomId, questionId, choice) {
  return requestJson(`/tacit/rooms/${encodeURIComponent(roomId)}/answer`, {
    method: "POST",
    data: { questionId, choice }
  });
}

export async function leaveTacitRoom(roomId) {
  return requestJson(`/tacit/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
}
