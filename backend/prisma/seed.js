import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "123456";
const VIRTUAL_USER_COUNT = 12;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(existingPhones) {
  let phone = "";
  do {
    const suffix = String(randomInt(0, 999999999)).padStart(9, "0");
    phone = `19${suffix}`;
  } while (existingPhones.has(phone));
  existingPhones.add(phone);
  return phone;
}

function buildVirtualUser(index, existingPhones) {
  const male = index % 2 === 0;
  const hobbiesPool = male
    ? ["篮球,音乐,露营", "健身,游戏,电影", "跑步,摄影,咖啡"]
    : ["旅行,探店,摄影", "阅读,瑜伽,电影", "羽毛球,音乐,美食"];
  const cityPool = ["上海", "深圳", "广州", "杭州", "成都", "北京"];
  const hometownPool = ["南京", "武汉", "西安", "苏州", "青岛", "重庆"];
  const photoSeed = 200 + index;

  return {
    phone: randomPhone(existingPhones),
    password: DEFAULT_PASSWORD,
    nickname: `guest${String(index + 1).padStart(2, "0")}`,
    gender: male ? "MALE" : "FEMALE",
    age: randomInt(22, 30),
    height: male ? randomInt(170, 186) : randomInt(158, 172),
    weight: male ? randomInt(62, 82) : randomInt(45, 60),
    hometown: hometownPool[index % hometownPool.length],
    currentCity: cityPool[index % cityPool.length],
    income: "8k-15k",
    industry: "互联网",
    hobbies: hobbiesPool[index % hobbiesPool.length],
    partnerExpectation: "真诚沟通，三观契合",
    profileCompleted: true,
    photoUrls: JSON.stringify([`https://picsum.photos/300/300?${photoSeed}`])
  };
}

function buildNamedFriendUser(nickname, index, existingPhones) {
  const profiles = [
    { gender: "MALE", hometown: "南京", currentCity: "上海", hobbies: "跑步,电影,咖啡" },
    { gender: "MALE", hometown: "西安", currentCity: "深圳", hobbies: "健身,旅行,摄影" },
    { gender: "FEMALE", hometown: "苏州", currentCity: "杭州", hobbies: "探店,羽毛球,音乐" },
    { gender: "FEMALE", hometown: "青岛", currentCity: "北京", hobbies: "阅读,徒步,烘焙" },
    { gender: "MALE", hometown: "重庆", currentCity: "广州", hobbies: "篮球,唱歌,桌游" }
  ];
  const profile = profiles[index % profiles.length];
  return {
    phone: randomPhone(existingPhones),
    password: DEFAULT_PASSWORD,
    nickname,
    gender: profile.gender,
    age: randomInt(22, 30),
    height: profile.gender === "MALE" ? randomInt(170, 186) : randomInt(158, 172),
    weight: profile.gender === "MALE" ? randomInt(62, 82) : randomInt(45, 60),
    hometown: profile.hometown,
    currentCity: profile.currentCity,
    income: "10k-20k",
    industry: "互联网",
    hobbies: profile.hobbies,
    partnerExpectation: "真诚沟通，三观契合",
    profileCompleted: true,
    photoUrls: JSON.stringify([`https://picsum.photos/300/300?${300 + index}`])
  };
}

async function main() {
  const defaults = [
    {
      phone: "13800000001",
      password: DEFAULT_PASSWORD,
      nickname: "星河",
      gender: "FEMALE",
      age: 25,
      height: 165,
      weight: 50,
      hometown: "成都",
      currentCity: "深圳",
      income: "15k-25k",
      industry: "互联网",
      hobbies: "旅行,电影,摄影",
      partnerExpectation: "三观契合，有责任感",
      profileCompleted: true,
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?1"])
    },
    {
      phone: "13800000002",
      password: DEFAULT_PASSWORD,
      nickname: "阿北",
      gender: "MALE",
      age: 27,
      height: 178,
      weight: 72,
      hometown: "武汉",
      currentCity: "广州",
      income: "10k-20k",
      industry: "产品",
      hobbies: "篮球,音乐,露营",
      partnerExpectation: "善良，愿意沟通",
      profileCompleted: true,
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?2"])
    },
    {
      phone: "13800000003",
      password: DEFAULT_PASSWORD,
      nickname: "ellie",
      gender: "FEMALE",
      age: 23,
      height: 166,
      weight: 49,
      hometown: "杭州",
      currentCity: "上海",
      income: "12k-18k",
      industry: "设计",
      hobbies: "拍照,探店,旅行",
      partnerExpectation: "温柔靠谱，有上进心",
      profileCompleted: true,
      photoUrls: JSON.stringify(["https://picsum.photos/300/300?3"])
    }
  ];
  await prisma.user.createMany({ data: defaults, skipDuplicates: true });

  const existing = await prisma.user.findMany({ select: { phone: true, nickname: true } });
  const existingPhones = new Set(existing.map((item) => item.phone));
  const existingByNickname = new Set(existing.map((item) => item.nickname));

  const namedFriends = ["alan", "phil", "juni", "dace", "jay"];
  const missingNamed = namedFriends.filter((nickname) => !existingByNickname.has(nickname));
  if (missingNamed.length > 0) {
    const namedUsers = missingNamed.map((nickname, idx) => buildNamedFriendUser(nickname, idx, existingPhones));
    await prisma.user.createMany({ data: namedUsers, skipDuplicates: true });
  }

  const usersAfterNamed = await prisma.user.findMany({ select: { phone: true, nickname: true } });
  const phonesAfterNamed = new Set(usersAfterNamed.map((item) => item.phone));
  const existingVirtualCount = usersAfterNamed.filter((item) => item.nickname.startsWith("guest")).length;
  const missingVirtual = Math.max(0, VIRTUAL_USER_COUNT - existingVirtualCount);
  if (missingVirtual > 0) {
    const startIndex = existingVirtualCount;
    const virtualUsers = Array.from({ length: missingVirtual }, (_, idx) => buildVirtualUser(startIndex + idx, phonesAfterNamed));
    await prisma.user.createMany({ data: virtualUsers, skipDuplicates: true });
  }

  await prisma.adminAccount.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      passwordHash: bcrypt.hashSync("123456", 10),
      canManageUsers: true
    },
    update: {}
  });

  await prisma.adminAccount.upsert({
    where: { username: "eliie" },
    create: {
      username: "eliie",
      passwordHash: bcrypt.hashSync("123456", 10),
      canManageUsers: false
    },
    update: {}
  });

  // 常见拼写 ellie（两个 l）；与 eliie 同为受限账号
  await prisma.adminAccount.upsert({
    where: { username: "ellie" },
    create: {
      username: "ellie",
      passwordHash: bcrypt.hashSync("123456", 10),
      canManageUsers: false
    },
    update: {}
  });

  // 与 ellie 相同：可登录管理后台，但无「用户管理」等 canManageUsers 能力
  await prisma.adminAccount.upsert({
    where: { username: "juni" },
    create: {
      username: "juni",
      passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
      canManageUsers: false
    },
    update: {
      passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
      canManageUsers: false
    }
  });
  await prisma.adminAccount.upsert({
    where: { username: "jace" },
    create: {
      username: "jace",
      passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
      canManageUsers: false
    },
    update: {
      passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
      canManageUsers: false
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
