import { requestJson } from "./api";

export function fetchGiftCatalog() {
  return requestJson("/gifts/catalog");
}

export async function sendGift(toUserId, giftId, quantity = 1) {
  return requestJson("/gifts/send", {
    method: "POST",
    data: { toUserId, giftId, quantity }
  });
}
