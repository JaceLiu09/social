export default {
  pages: [
    "pages/login/index",
    "pages/profile-setup/index",
    "pages/planet/index",
    "pages/square/index",
    "pages/chat/index",
    "pages/me/index",
    "pages/match/index",
    "pages/chat-room/index",
    "pages/game/index",
    "pages/peer-profile/index",
    "pages/me-wallet/index",
    "pages/me-edit/index",
    "pages/me-compose/index",
    "pages/legal/index"
  ],
  window: {
    navigationBarTitleText: "盲盒星球",
    navigationBarBackgroundColor: "#111827",
    navigationBarTextStyle: "white",
    backgroundColor: "#f5f6fb",
    backgroundTextStyle: "light"
  },
  tabBar: {
    color: "#9ca3af",
    selectedColor: "#111827",
    backgroundColor: "#ffffff",
    borderStyle: "black",
    list: [
      {
        pagePath: "pages/planet/index",
        text: "盲盒星球"
      },
      {
        pagePath: "pages/square/index",
        text: "广场"
      },
      {
        pagePath: "pages/chat/index",
        text: "聊天"
      },
      {
        pagePath: "pages/me/index",
        text: "我的"
      }
    ]
  }
};
