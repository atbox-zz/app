# 🀄 中國麻將 Online v2.0

多人線上麻將遊戲，支援會員系統、邀請對戰、即時聊天、語音/視訊。

## 技術架構

| 層 | 技術 |
|---|---|
| 後端 | Java 25 + Spring Boot 3.4 |
| 即時通訊 | WebSocket (STOMP over SockJS) |
| 認證 | JWT + OAuth2 (Google / Facebook) |
| 資料庫 | H2 (開發) / PostgreSQL (生產) |
| 視訊/語音 | WebRTC (P2P, STUN) |
| 部署 | Railway / Render |

## 功能清單

- ✅ Email + 密碼 註冊/登入
- ✅ 手機號碼 OTP 登入
- ✅ Google OAuth2 登入
- ✅ Facebook OAuth2 登入
- ✅ 大廳房間列表（即時更新）
- ✅ 建立公開/私人房間
- ✅ 邀請碼加入（6碼）
- ✅ 線上多人對戰（1-4 真人 + AI 補位）
- ✅ AI 四種難度
- ✅ 即時文字聊天
- ✅ WebRTC 語音通話
- ✅ WebRTC 視訊鏡頭
- ✅ 四首 BGM 可切換
- ✅ 遊戲音效

---

## 本地開發

### 需求
- Java 25 (`java -version` 確認)
- Maven 3.9+

### 啟動（H2 記憶體資料庫，免設定）
```bash
./mvnw spring-boot:run
# Windows
mvnw.cmd spring-boot:run
```

訪問：http://localhost:8080

### H2 資料庫管理介面
http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:mahjongdb`
- Username: `sa` / Password: (空)

---

## OAuth2 設定

### Google

1. 前往 https://console.cloud.google.com
2. 建立專案 → APIs & Services → Credentials
3. 建立 OAuth 2.0 Client ID（Web application）
4. Authorized redirect URIs 加入：
   - `http://localhost:8080/login/oauth2/code/google`（本地）
   - `https://你的網域/login/oauth2/code/google`（生產）
5. 複製 Client ID 和 Client Secret

### Facebook

1. 前往 https://developers.facebook.com
2. My Apps → Create App → Consumer
3. Facebook Login → Settings
4. Valid OAuth Redirect URIs 加入：
   - `http://localhost:8080/login/oauth2/code/facebook`
   - `https://你的網域/login/oauth2/code/facebook`
5. 複製 App ID 和 App Secret

### 設定環境變數
```bash
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret
export FACEBOOK_CLIENT_ID=your-app-id
export FACEBOOK_CLIENT_SECRET=your-app-secret
export JWT_SECRET=your-super-long-secret-at-least-32-chars
```

---

## 手機 OTP（Twilio 整合）

在 `AuthService.java` 的 `sendOtp()` 方法中加入：

```java
// Maven dependency:
// com.twilio.sdk:twilio:10.x.x

Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
Message.creator(
    new PhoneNumber(phone),
    new PhoneNumber("+你的Twilio號碼"),
    "您的麻將驗證碼：" + otp
).create();
```

開發期間 OTP 會直接印在 console log。

---

## 生產資料庫（PostgreSQL）

設定以下環境變數：
```
DATABASE_URL=jdbc:postgresql://host:5432/mahjong
DB_USER=postgres
DB_PASS=yourpassword
DB_DRIVER=org.postgresql.Driver
DB_DIALECT=org.hibernate.dialect.PostgreSQLDialect
```

Railway 自動注入 PostgreSQL URL，可直接使用。

---

## 部署到 Railway（推薦）

```bash
# 1. 初始化 Git
git init && git add . && git commit -m "init"

# 2. 推到 GitHub
git remote add origin https://github.com/你/mahjong-online.git
git push -u origin main

# 3. 到 railway.app
#    New Project → Deploy from GitHub → 選 repo
#    自動偵測 Maven，約 3 分鐘部署完成

# 4. 設定環境變數（Railway Variables 頁面）
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
JWT_SECRET=...長字串...
FRONTEND_URL=https://你的網域.railway.app
ALLOWED_ORIGINS=https://你的網域.railway.app
```

## 部署到 Render（備用）

| 欄位 | 值 |
|---|---|
| Build Command | `mvn clean package -DskipTests` |
| Start Command | `java -jar target/mahjong-online-2.0.0.jar` |
| Java Version | 25 |

---

## 專案結構

```
src/main/java/com/mahjong/
├── MahjongApplication.java
├── config/
│   ├── SecurityConfig.java      ← JWT + OAuth2 + CORS
│   └── WebSocketConfig.java     ← STOMP over SockJS
├── model/
│   ├── User.java                ← 會員（email/phone/oauth）
│   ├── GameRoom.java            ← 遊戲房間
│   ├── ChatMessage.java         ← 聊天/WebRTC 信令
│   └── ... （牌組模型）
├── repository/
│   ├── UserRepository.java
│   └── GameRoomRepository.java
├── service/
│   ├── JwtService.java          ← Token 生成/驗證
│   ├── AuthService.java         ← 登入/註冊/OTP/OAuth
│   ├── GameService.java         ← 遊戲邏輯（多人）
│   └── ... （牌組/AI服務）
├── security/
│   ├── JwtAuthFilter.java       ← 每次請求驗證 token
│   └── OAuth2SuccessHandler.java← OAuth2 完成後發 JWT
└── controller/
    ├── AuthController.java      ← /api/auth/**
    ├── UserController.java      ← /api/user/**
    ├── RoomController.java      ← /api/rooms/**
    ├── GameController.java      ← /api/game/**
    ├── WebSocketController.java ← STOMP handlers
    └── IndexController.java     ← SPA fallback
```

---

## WebRTC 視訊架構

```
玩家A                伺服器              玩家B
  |--- SDP Offer ---> WS Relay ----->    |
  |<-- SDP Answer --- WS Relay ------    |
  |--- ICE Candidate > WS Relay --->    |
  |<-- ICE Candidate < WS Relay ----    |
  |                                      |
  |<======= P2P 直連 視訊/語音 =========>|
```

信令透過 Spring WebSocket 中繼，媒體流走瀏覽器直連（P2P），伺服器不承載視訊流量。
