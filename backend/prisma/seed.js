import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.createMany({
    data: [
      {
        phone: "13800000001",
        password: "123456",
        nickname: "星河",
        gender: "FEMALE",
        age: 25,
        height: 165,
        weight: 50,
        hometown: "成都",
        currentCity: "深圳",
        hobbies: "旅行,电影,摄影",
        partnerExpectation: "三观契合，有责任感",
        photoUrls: JSON.stringify(["https://picsum.photos/300/300?1"])
      },
      {
        phone: "13800000002",
        password: "123456",
        nickname: "阿北",
        gender: "MALE",
        age: 27,
        height: 178,
        weight: 72,
        hometown: "武汉",
        currentCity: "广州",
        hobbies: "篮球,音乐,露营",
        partnerExpectation: "善良，愿意沟通",
        photoUrls: JSON.stringify(["https://picsum.photos/300/300?2"])
      },
      {
        phone: "ellie",
        password: "123456",
        nickname: "ellie",
        gender: "FEMALE",
        age: 23,
        height: 166,
        weight: 49,
        hometown: "杭州",
        currentCity: "上海",
        hobbies: "拍照,探店,旅行",
        partnerExpectation: "温柔靠谱，有上进心",
        photoUrls: JSON.stringify(["https://picsum.photos/300/300?3"])
      }
    ],
    skipDuplicates: true
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
