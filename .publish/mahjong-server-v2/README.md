# 🀄 中國麻將線上平台

NestJS 後端 + Socket.io 即時通訊 + SQLite 資料庫

## 快速啟動

```bash
# 1. 安裝依賴
npm install

# 2. 建立環境設定
cp .env.example .env

# 3. 開發模式啟動（自動重載）
npm run start:dev

# 瀏覽器開啟
open http://localhost:3000
```

## 功能

| 功能 | 說明 |
|------|------|
| 🔐 登入 / 註冊 | JWT 認證，密碼 bcrypt 加密 |
| 🎮 單人遊戲 | vs 三個電腦 AI，結果自動儲存 |
| 📊 戰績系統 | 勝敗場、籌碼增減、特殊牌型紀錄 |
| 💬 大廳聊天 | 即時 WebSocket 廣播，有打字指示 |
| 📩 私訊 (DM) | 點擊玩家名稱可私聊 |
| 📧 邀請系統 | 送出/接受對戰邀請，即時 Toast 通知 |
| 🏆 排行榜 | `GET /api/users/leaderboard` |

## API 端點

### Auth
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/auth/register | 註冊 `{username, password, displayName?}` |
| POST | /api/auth/login    | 登入 `{username, password}` → `{access_token, user}` |
| POST | /api/auth/logout   | 登出（需 Bearer token）|

### Users
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET  | /api/users/me           | 我的資料 |
| GET  | /api/users/leaderboard  | 排行榜 Top 20 |
| GET  | /api/users/online       | 在線玩家列表 |

### Records
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | /api/records          | 儲存一局結果 |
| GET  | /api/records/my       | 我的戰績列表 |
| GET  | /api/records/my/stats | 我的統計數據 |
| GET  | /api/records/player/:id | 他人戰績 |

## WebSocket 事件（連線到 `/ws`）

```js
const socket = io('/ws', { auth: { token: 'Bearer ...' } });

// 大廳聊天
socket.emit('chat:lobby', { content: '你好！' });
socket.on('chat:message', msg => console.log(msg));

// 私訊
socket.emit('chat:dm', { toId: 5, content: '要打牌嗎？' });
socket.on('chat:dm', msg => console.log(msg));

// 邀請
socket.emit('invite:send', { toId: 5 });
socket.on('invite:received', inv => { /* 顯示接受/拒絕 UI */ });
socket.emit('invite:respond', { inviteId: inv.id, accept: true });

// 在線玩家
socket.on('users:online', players => renderList(players));
```

## 資料庫

SQLite，自動建表，無需額外設定。
正式部署建議改用 PostgreSQL（修改 `app.module.ts` 的 TypeORM 設定）。
