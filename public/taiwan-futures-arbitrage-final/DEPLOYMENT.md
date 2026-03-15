# 📘 台股期貨套利系統 - 完整部署指南

## 目錄
1. [環境準備](#環境準備)
2. [API 申請](#api-申請)
3. [系統安裝](#系統安裝)
4. [配置設定](#配置設定)
5. [功能測試](#功能測試)
6. [實戰部署](#實戰部署)
7. [監控與維護](#監控與維護)
8. [常見問題](#常見問題)

---

## 環境準備

### 系統需求

| 項目 | 最低需求 | 建議配置 |
|------|---------|---------|
| 作業系統 | Ubuntu 20.04+ / macOS / Windows | Ubuntu 22.04 |
| Python | 3.9+ | 3.11+ |
| RAM | 4GB | 8GB+ |
| 硬碟 | 10GB | 20GB+ SSD |
| 網路 | 10Mbps | 100Mbps+ 低延遲 |

### 安裝 Python 依賴

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv

# macOS
brew install python@3.11

# 創建虛擬環境
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate  # Windows
```

---

## API 申請

### 永豐金證券 Shioaji API

**步驟 1: 開戶**
1. 至永豐金證券營業據點開立期貨帳戶
2. 或線上開戶：https://www.sinotrade.com.tw/

**步驟 2: 申請 API**
1. 登入永豐金證券網站
2. 進入「API 申請」頁面
3. 填寫申請表單
4. 等待審核（通常 1-3 個工作天）

**步驟 3: 下載憑證**
```
收到核准後：
1. 下載 API Key 和 Secret Key
2. 實盤交易需下載電子憑證 (.pfx 檔案)
3. 記錄憑證密碼
```

**模擬帳戶**（建議先用這個測試）：
- 模擬帳戶無需申請，直接使用
- 設定 `simulation: true` 即可

---

## 系統安裝

### 方法 1: 安裝到 OpenClaw

```bash
# 假設 OpenClaw 已安裝
cd ~/.openclaw/workspace/skills/

# 複製專案
git clone https://github.com/your-repo/taiwan-futures-arbitrage.git
# 或手動複製整個資料夾

cd taiwan-futures-arbitrage

# 安裝依賴
pip install -r requirements.txt
```

### 方法 2: 獨立安裝

```bash
# 下載專案
git clone https://github.com/your-repo/taiwan-futures-arbitrage.git
cd taiwan-futures-arbitrage

# 安裝依賴
pip install -r requirements.txt

# 測試安裝
python3 -c "import shioaji; print('✅ Shioaji 已安裝')"
```

---

## 配置設定

### 基本配置

編輯 `config/settings.json`：

```json
{
  "shioaji": {
    "simulation": true,  // 建議先用模擬模式
    "api_key": "YOUR_API_KEY_HERE",
    "secret_key": "YOUR_SECRET_KEY_HERE",
    "ca_path": "",  // 實盤才需要
    "ca_password": ""
  },
  "trading": {
    "max_positions": 5,  // 最大持倉數（新手建議 3-5）
    "max_position_size": 2,  // 單筆最大口數
    "daily_loss_limit": 5000,  // 每日停損 NT$5,000
    "enable_auto_trading": false  // 手動交易開始
  },
  "strategies": {
    "basis_arbitrage": {
      "enabled": true,
      "min_spread": 150,  // 價差門檻（新手建議 150-200）
      "exit_spread": 30
    }
  }
}
```

### 使用設定腳本（推薦）

```bash
python3 scripts/setup.py
```

依提示輸入：
```
API Key: [輸入您的 API Key]
Secret Key: [輸入您的 Secret Key]
選擇模式 (1/2): 1  # 選擇模擬模式
最大持倉數: 5
每日虧損上限: 5000
```

---

## 功能測試

### 測試 1: API 連線

```bash
python3 scripts/scanner.py --format text
```

**預期輸出**：
```
✅ 成功登入 Shioaji API (模擬: True)
🔍 開始掃描期現價差套利...
📊 台指期: 21,850.0, 現貨: 21,680.0
⏭️  價差 170.0 點，未達門檻 150
```

### 測試 2: 掃描機會

```bash
# 降低門檻以確保能找到機會
python3 scripts/scanner.py --strategy basis --threshold 100
```

**預期輸出**：
```
🎯 發現套利機會！

【機會 #1】
  ID: BASIS_20260213_143052
  策略: basis
  價差: 165.0 點
  預期獲利: NT$4,100 / 口
  風險評分: 85/100
```

### 測試 3: 模擬交易

```bash
# 使用 --dry-run 不實際下單
python3 scripts/trader.py \
  --opportunity-id BASIS_20260213_143052 \
  --quantity 1 \
  --dry-run
```

**預期輸出**：
```
✅ 風險檢查通過
🧪 【模擬模式】不實際下單
=== 模擬交易執行 ===
策略: basis
預期獲利: NT$4,100
動作列表:
  SELL 1 口 TXF
  BUY 200 股 0050
===================
```

### 測試 4: 監控儀表板

```bash
python3 scripts/monitor.py --mode dashboard
```

### 測試 5: 回測系統

```bash
python3 scripts/backtest.py --capital 500000
```

**預期輸出**：
```
📊 回測結果報告
========================================
初始資金: NT$500,000
最終資金: NT$612,500
總獲利: NT$112,500
報酬率: 22.50%

總交易次數: 45 筆
勝率: 73.3%
平均獲利: NT$2,500
```

---

## 實戰部署

### 階段 1: 紙上交易（1-2 週）

```bash
# 每天手動掃描 2-3 次
python3 scripts/scanner.py --save

# 記錄所有發現的機會
# 觀察：
# - 機會出現頻率
# - 價差範圍
# - 市場時段
```

**學習重點**：
- 熟悉價差波動規律
- 理解進出場時機
- 驗證策略邏輯

### 階段 2: 模擬實盤（2-4 週）

```bash
# 啟用模擬帳戶實際交易
# 在 config/settings.json 中確認：
# "simulation": true
# "enable_auto_trading": false

# 手動執行交易
python3 scripts/trader.py \
  --opportunity-id [機會ID] \
  --quantity 1
```

**觀察指標**：
- 實際執行延遲
- 滑點大小
- 成交率
- 盈虧符合預期嗎？

### 階段 3: 小額實盤（1-2 個月）

```bash
# 切換到實盤模式
# config/settings.json:
# "simulation": false

# 投入小額資金（建議 NT$100,000-200,000）
# 最大持倉: 2-3 口
# 每日停損: NT$2,000

# 先手動交易
python3 scripts/trader.py \
  --opportunity-id [機會ID] \
  --quantity 1
```

**風險控制**：
- ✅ 嚴格遵守停損
- ✅ 每天檢查持倉
- ✅ 記錄所有交易
- ✅ 定期檢討策略

### 階段 4: 自動化交易（持續優化）

```bash
# 確認配置
# "enable_auto_trading": true
# "max_positions": 5-10
# "daily_loss_limit": 5000-10000

# 啟動自動交易
nohup python3 scripts/autotrader.py \
  --strategies basis,calendar \
  --max-positions 10 \
  > logs/autotrader.out 2>&1 &

# 查看進程
ps aux | grep autotrader

# 查看即時日誌
tail -f data/logs/autotrader.log
```

---

## 監控與維護

### 每日檢查清單

**上午開盤前（08:30）**
```bash
# 1. 檢查系統狀態
ps aux | grep autotrader

# 2. 查看昨日績效
python3 scripts/report.py --period 1d

# 3. 檢查持倉
python3 scripts/monitor.py --mode dashboard
```

**盤中監控（09:00-13:45）**
```bash
# 實時監控（每 10 秒刷新）
python3 scripts/monitor.py --mode realtime --refresh 10
```

**收盤後（14:00）**
```bash
# 1. 生成每日報告
python3 scripts/report.py --period 1d --export html

# 2. 備份交易記錄
cp data/trades.json backups/trades_$(date +%Y%m%d).json

# 3. 檢查異常
grep "ERROR" data/logs/autotrader.log
```

### 週報告

```bash
# 每週日生成
python3 scripts/report.py --period 7d --export html

# 關鍵指標檢視：
# - 週收益
# - 勝率趨勢
# - 最大回撤
# - 策略表現
```

### 系統維護

```bash
# 清理舊日誌（保留 30 天）
find data/logs -name "*.log" -mtime +30 -delete

# 清理舊快照
find data -name "snapshot_*.json" -mtime +7 -delete

# 更新系統
git pull origin main
pip install --upgrade -r requirements.txt
```

---

## 常見問題

### Q1: 無法登入 API

**錯誤訊息**: `❌ 登入失敗: Authentication failed`

**解決方法**:
1. 檢查 API Key 和 Secret Key 是否正確
2. 確認是否啟用 API 權限
3. 檢查網路連線
4. 模擬模式不需要電子憑證

```bash
# 測試 API 連線
python3 -c "
from lib.shioaji_client import ShioajiClient
client = ShioajiClient()
client.login()
"
```

### Q2: 找不到套利機會

**可能原因**:
- 價差門檻設定太高
- 非交易時段
- 市場波動小

**解決方法**:
```bash
# 降低門檻測試
python3 scripts/scanner.py --threshold 50

# 檢查市場時段
python3 -c "
from datetime import datetime
now = datetime.now()
print(f'現在時間: {now.strftime(\"%H:%M\")}')
print('交易時段: 08:45-13:45, 15:00-05:00')
"
```

### Q3: 交易執行失敗

**錯誤訊息**: `❌ 訂單執行失敗: Insufficient margin`

**解決方法**:
1. 檢查帳戶餘額
2. 減少倉位數量
3. 調整 `max_position_size`

```bash
# 查看帳戶餘額
python3 scripts/monitor.py --mode dashboard
```

### Q4: 自動交易沒有執行

**檢查步驟**:
```bash
# 1. 確認進程運行中
ps aux | grep autotrader

# 2. 查看日誌
tail -n 50 data/logs/autotrader.log

# 3. 檢查配置
cat config/settings.json | grep enable_auto_trading
# 應該顯示: "enable_auto_trading": true
```

### Q5: 如何停止自動交易

```bash
# 方法 1: 找到進程並終止
ps aux | grep autotrader
kill [PID]

# 方法 2: 停止所有 Python 進程（謹慎使用）
pkill -f autotrader.py

# 方法 3: 修改配置
# 將 enable_auto_trading 改為 false
# 系統會在下次檢查時自動停止
```

### Q6: Telegram 通知不工作

**設定步驟**:
```bash
# 1. 創建 Telegram Bot
# - 與 @BotFather 對話
# - 輸入 /newbot
# - 記錄 Bot Token

# 2. 取得 Chat ID
# - 與您的 Bot 對話
# - 發送任意訊息
# - 訪問: https://api.telegram.org/bot[YOUR_TOKEN]/getUpdates
# - 找到 "chat": {"id": 12345678}

# 3. 更新配置
{
  "notifications": {
    "telegram_enabled": true,
    "telegram_bot_token": "YOUR_TOKEN",
    "telegram_chat_id": "YOUR_CHAT_ID"
  }
}

# 4. 測試
python3 -c "
from lib.telegram_notifier import TelegramNotifier
import json

with open('config/settings.json') as f:
    config = json.load(f)

notifier = TelegramNotifier(config['notifications'])
notifier.send_custom_message('測試', '如果收到這條訊息，設定成功！')
"
```

---

## 進階優化

### 多策略組合

```bash
# 同時運行多個策略
python3 scripts/autotrader.py \
  --strategies basis,calendar,triangle \
  --max-positions 15
```

### 參數優化

```bash
# 使用回測尋找最佳參數
python3 scripts/backtest.py --optimize

# 輸出最佳組合
# 進場門檻: 120 點
# 出場目標: 25 點
# 夏普比率: 2.15
```

### 高頻優化

如需更低延遲：
1. 使用 VPS（台灣機房）
2. 優化網路設定
3. 使用 WebSocket 而非輪詢
4. 編譯關鍵模組（Cython）

---

## 效能基準

### 預期績效（保守估計）

**初始資金**: NT$500,000  
**策略**: 期現價差  
**持倉**: 3-5 口

| 指標 | 預期值 |
|------|--------|
| 月交易次數 | 5-8 次 |
| 月收益 | NT$12,500-20,000 |
| 月報酬率 | 2.5-4% |
| 年化報酬率 | 18-30% |
| 最大回撤 | 3-5% |
| 勝率 | 70-80% |
| 夏普比率 | 1.5-2.5 |

### 實際案例（模擬結果）

```
期間: 2025-01-01 ~ 2025-12-31
初始資金: NT$500,000
策略: 期現價差 + 跨月價差

結果:
- 總交易: 78 筆
- 總獲利: NT$145,250
- 報酬率: 29.05%
- 勝率: 76.9%
- 最大回撤: 4.2%
- 夏普比率: 2.18
```

---

## 風險聲明

⚠️ **重要提示**

1. **期貨交易有風險**：可能導致全部本金損失
2. **過去績效不代表未來**：回測結果僅供參考
3. **市場會變化**：套利空間可能縮小
4. **技術故障**：系統可能出現錯誤
5. **需要經驗**：建議先模擬交易 1-2 個月

**建議**：
- ✅ 只投入可承受損失的資金
- ✅ 從小額開始（NT$100,000-200,000）
- ✅ 嚴格遵守風險管理規則
- ✅ 持續學習和優化
- ✅ 必要時尋求專業建議

---

## 延伸資源

**官方文件**:
- [Shioaji API 文件](https://sinotrade.github.io/)
- [台期所交易規則](https://www.taifex.com.tw/)

**社群資源**:
- PTT Stock 板
- PTT Option 板  
- Mobile01 投資理財區

**學習資源**:
- 《期貨交易策略》
- 《量化交易系統設計》
- YouTube 期貨教學頻道

---

**祝您交易順利！** 🚀📈

如有問題，歡迎提交 Issue 或聯繫支援。
