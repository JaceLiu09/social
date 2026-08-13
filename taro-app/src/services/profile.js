import { requestJson } from "./api";
import { getCurrentUser } from "./auth";

export function fetchContacts() {
  const user = getCurrentUser();
  const q = user?.id ? `?userId=${encodeURIComponent(user.id)}` : "";
  return requestJson(`/chat/contacts${q}`);
}

export function fetchUserProfile(userId) {
  return requestJson(`/users/${encodeURIComponent(userId)}/profile`);
}

export function fetchFollowStatus(userId) {
  return requestJson(`/users/${encodeURIComponent(userId)}/follow-status`);
}

export async function followUser(userId) {
  return requestJson(`/users/${encodeURIComponent(userId)}/follow`, { method: "POST" });
}

export async function unfollowUser(userId) {
  return requestJson(`/users/${encodeURIComponent(userId)}/follow`, { method: "DELETE" });
}

export function searchFriends(keyword) {
  return requestJson(`/friends/search?q=${encodeURIComponent(keyword)}`);
}

export async function sendFriendRequest(toUserId) {
  return requestJson("/friends/requests", {
    method: "POST",
    data: { toUserId }
  });
}

export function fetchIncomingFriendRequests() {
  return requestJson("/friends/requests/incoming");
}

export async function respondFriendRequest(requestId, accept) {
  return requestJson(`/friends/requests/${requestId}/respond`, {
    method: "POST",
    data: { accept }
  });
}

export async function publishSquarePost(text, imageUrls = []) {
  return requestJson("/square/posts", {
    method: "POST",
    data: { text, imageUrls }
  });
}

export function fetchMySquarePosts() {
  return requestJson("/square/posts/mine");
}

export function fetchRobotLibraryUser() {
  return requestJson("/planet/robot-library/user");
}
