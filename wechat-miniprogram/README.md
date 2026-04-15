# 微信小程序 + 微信云开发（CloudBase）

与仓库根目录 **Web 版（Vite + React）** 并列；Web 仍走浏览器与可选 `VITE_USER_PROFILE_URL`，小程序走 **云函数 `hicar_api` + 云数据库**。

## 目录结构

```
wechat-miniprogram/
├── project.config.json      # 微信开发者工具工程（填写 AppID）
├── miniprogram/             # 小程序前端
├── cloudfunctions/hicar_api/ # 用户 / 订单接口（需上传部署）
└── database.rules.json      # 数据库权限参考（可在控制台粘贴调整）
```

## 云函数接口（`action`）

| action | 说明 |
|--------|------|
| `user.get` | 按 `OPENID` 查或初始化用户 |
| `user.upsert` | 更新 `displayName`、`phoneMasked`、`avatarUrl`、`membershipLevelLabel`、`membershipLevelKey` |
| `orders.list` | 当前用户订单列表 |
| `orders.create` | 创建订单（body 字段与 Web 端 `OrderItem` 对齐，需含或可生成 `id`） |
| `orders.update` | `{ id, patch }` 局部更新 |
| `orders.delete` | `{ id }` |

## 部署步骤（摘要）

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，导入本目录 `wechat-miniprogram`。
2. 在 `project.config.json` 填写你的 **小程序 AppID**，并将 **`cloudbaseEnv`** 改为与云开发控制台一致的环境 ID（须与 `miniprogram/app.js` 里 **`CLOUD_ENV_ID`** 相同）。若提示 *please select an env in the editor (cloudfunctionRoot)*，多半是此处未配置；也可复制 `project.private.config.json.example` 为 **`project.private.config.json`** 并填写 `cloudbaseEnv`。
3. 工具栏 **云开发** → 开通环境，将 **环境 ID** 填入 `miniprogram/app.js` 的 `CLOUD_ENV_ID`。
4. 云开发控制台 → **数据库** → 新建集合 **`users`**、**`orders`**（可先仅云函数访问，权限见 `database.rules.json`）。
5. 右键 **`cloudfunctions/hicar_api`** → **上传并部署：云端安装依赖**。
6. 编译运行小程序：首页完成 **预约流程**（点头像/同步云函数 `user.get` 拉取用户后可提交订单），**个人中心** 按状态 Tab 查看订单，**订单详情** 支持取消 / 联系司机（进入租赁中）/ **费用结算** 与 **结束行程**（同逻辑），**预约结果** 页会 `orders.create` 写入云库并清空首页上下车草稿。

### 页面（与 Web 页面对齐）

| 小程序页面 | 对应 React |
|-----------|------------|
| `pages/home/home` | `Home` |
| `pages/me/me` | `Profile`（订单 Tab 列表） |
| `pages/order-detail/order-detail` | `OrderDetail` |
| `pages/booking-result/booking-result` | `BookingResult` |
| `pages/membership/membership` | `MembershipLevels` |
| `pages/choose-location/choose-location` | 地图选点（对应 Web 的地址选择；此处用 `wx.chooseLocation`） |

## Web 端对接同一套后端（可选）

可在腾讯云 **云开发控制台** 为云函数配置 **HTTP 访问服务**，或使用 **云调用 / 开放 API**，让浏览器通过 HTTPS 调同一数据库逻辑；当前仓库 Web 仍默认本地 `localStorage` + 静态 mock，需你自行增加 `fetch` 与鉴权。
