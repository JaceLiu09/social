import { nanoid } from "nanoid";

export const db = {
  users: [],
  matchSessions: [],
  plazaPosts: [
    {
      id: nanoid(),
      blindboxName: "男生盲盒 #1021",
      content: "今天加班太晚，谁懂。",
      likes: 24
    },
    {
      id: nanoid(),
      blindboxName: "女生盲盒 #8832",
      content: "希望碰到情绪稳定的人。",
      likes: 57
    }
  ]
};

export function createUser(payload) {
  const user = {
    id: nanoid(),
    nickname: payload.nickname,
    gender: payload.gender,
    age: Number(payload.age),
    height: Number(payload.height || 0),
    hometown: payload.hometown || "",
    city: payload.city || "",
    hobbies: payload.hobbies || "",
    partnerRequirement: payload.partnerRequirement || "",
    membershipActive: false,
    profileUnlocked: false
  };
  db.users.push(user);
  return user;
}

export function createMatchSession(user, partner) {
  const session = {
    id: nanoid(),
    userId: user.id,
    partnerId: partner.id,
    partnerBlindboxName: `${partner.gender === "female" ? "女生" : "男生"}盲盒 #${partner.id.slice(
      0,
      4
    )}`,
    rounds: 0,
    friendliness: 0,
    unlocked: false
  };
  db.matchSessions.push(session);
  return session;
}
