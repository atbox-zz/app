# 🀄 中國麻將遊戲 (Chinese Mahjong)

基於 **Java 17 + Spring Boot 3** 實作的中國國標麻將網頁遊戲。

## 功能特色

- ✅ 完整 144 張牌組（萬/筒/索/風/箭/花）
- ✅ 1 名玩家 + 3 名 AI（4 個難度等級）
- ✅ 完整動作支援：摸牌、打牌、吃、碰、明槓、暗槓、加槓、胡牌、自摸
- ✅ 向聽數計算（AI 策略核心）
- ✅ 番數計算（門前清、清一色、七對、碰碰胡、自摸等）
- ✅ 計分結算（自摸 vs 點炮，流局處理）
- ✅ 多種局數模式（4 / 8 / 16 局）
- ✅ 現代中式 UI，深綠桌面風格

## 快速開始

### 環境需求
- Java 17+
- Maven 3.8+（或使用內建 Maven Wrapper）

### 啟動方式

**Linux / macOS：**
```bash
chmod +x mvnw
./mvnw spring-boot:run
```

**Windows：**
```cmd
mvnw.cmd spring-boot:run
```

**已有 Maven：**
```bash
mvn spring-boot:run
```

啟動後開啟瀏覽器訪問：**http://localhost:8080**

## 遊戲說明

1. 選擇 AI 難度和局數後點選「開始遊戲」
2. 點選手牌選取（再次點選取消），選好後點「打牌」
3. 其他玩家打出牌時，可選擇「吃/碰/槓/胡牌/過」
4. 自摸時可選擇「自摸」或繼續打牌
5. 局結束後查看番數結算，繼續下一局

## 技術架構

```
src/main/java/com/mahjong/
├── MahjongApplication.java        # Spring Boot 入口
├── model/                         # 資料模型
│   ├── Tile.java                  # 麻將牌（含 Unicode 符號）
│   ├── Player.java                # 玩家狀態
│   ├── GameState.java             # 遊戲全域狀態
│   ├── MeldGroup.java             # 面子（順/刻/槓）
│   ├── WinResult.java             # 胡牌結果與番數
│   └── ...（各種 Enum）
├── service/
│   ├── TileFactory.java           # 牌組生成與洗牌
│   ├── WinChecker.java            # 胡牌判定 + 番數計算
│   ├── ShantenCalculator.java     # 向聽數計算（AI 核心）
│   ├── ScoreCalculator.java       # 計分結算
│   └── GameService.java           # 主遊戲邏輯流程
├── ai/
│   └── AIEngine.java              # AI 決策（4 難度等級）
└── controller/
    └── GameController.java        # REST API

src/main/resources/static/
└── index.html                     # 單頁前端（純 HTML/CSS/JS）
```

## REST API

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/game/start` | 開始新遊戲 |
| GET  | `/api/game/{id}` | 取得遊戲狀態 |
| POST | `/api/game/{id}/action` | 執行動作 |
| POST | `/api/game/{id}/next-round` | 進入下一局 |

### 動作類型
```json
{ "type": "DISCARD",      "tileId": "42" }
{ "type": "CHI",          "chiTileIds": ["10","11"] }
{ "type": "PENG" }
{ "type": "GANG" }
{ "type": "AN_GANG",      "tileId": "7" }
{ "type": "WIN" }
{ "type": "SELF_DRAW_WIN" }
{ "type": "PASS" }
```
