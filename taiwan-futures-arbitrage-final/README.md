# Taiwan Futures Arbitrage - OpenClaw Skill

台股期貨自動套利系統 - OpenClaw AI Agent 技能

## 📖 簡介

這是一個完整的台股期貨套利交易系統，作為 OpenClaw (AI Agent) 的 Skill 運行。系統支援多種套利策略，可以 24/7 自動監控市場、發現套利機會並執行交易。

### 支援的策略

1. **期現價差套利 (Basis Arbitrage)**
   - 利用期貨與現貨指數的價差
   - 預期收益：每口 NT$2,000-5,000
   - 風險等級：低

2. **跨月價差套利 (Calendar Spread)**
   - 利用近月與次月合約的價差
   - 預期收益：每口 NT$1,500-3,000
   - 風險等級：低

3. **三角套利 (Triangle Arbitrage)**
   - 利用台指期、電子期、金融期的組合價差
   - 預期收益：每口 NT$2,500-4,000
   - 風險等級：中

## 🚀 快速開始

### 1. 安裝到 OpenClaw

```bash
# 將整個目錄複製到 OpenClaw skills 目錄
cp -r taiwan-futures-arbitrage ~/.openclaw/workspace/skills/

# 安裝 Python 依賴
cd ~/.openclaw/workspace/skills/taiwan-futures-arbitrage
pip install -r requirements.txt
```

### 2. 設定 API 憑證

編輯 `config/settings.json`：

```json
{
  "shioaji": {
    "simulation": true,
    "api_key": "YOUR_SINOPAC_API_KEY",
    "secret_key": "YOUR_SINOPAC_SECRET_KEY"
  }
}
```

**取得 API 憑證**：
1. 開立永豐金證券帳戶
2. 至 [永豐 API 網站](https://www.sinotrade.com.tw/ec/20191125/Main/index.aspx) 申請
3. 下載電子憑證（實盤交易必需）

### 3. 測試連線

```bash
cd ~/.openclaw/workspace/skills/taiwan-futures-arbitrage
python3 scripts/scanner.py --format text
```

如果成功，您會看到：
```
✅ 成功登入 Shioaji API (模擬: True)
🔍 開始掃描期現價差套利...
```

## 💬 在 OpenClaw 中使用

### 透過 Telegram 控制（推薦）

```
你: "掃描台指期套利機會"
Claude: [執行 scanner.py 並顯示結果]

你: "價差超過 150 點的機會有哪些？"
Claude: [執行 scanner.py --threshold 150]

你: "執行套利機會 BASIS_20260213_143052，交易 3 口"
Claude: [執行 trader.py --opportunity-id BASIS_20260213_143052 --quantity 3]

你: "啟動自動交易，只用期現價差策略"
Claude: [執行 autotrader.py --strategies basis]
```

### 直接命令行使用

```bash
# 掃描套利機會
python3 scripts/scanner.py --strategy basis --threshold 150

# 執行交易（模擬）
python3 scripts/trader.py \
  --opportunity-id BASIS_20260213_143052 \
  --quantity 2 \
  --dry-run

# 啟動自動交易
python3 scripts/autotrader.py \
  --strategies basis,calendar \
  --max-positions 5
```

## 📊 完整使用範例

### 場景 1：手動掃描 + 執行

```bash
# 步驟 1: 掃描機會
python3 scripts/scanner.py --save

# 輸出：
# 🎯 發現套利機會！
# 【機會 #1】
#   ID: BASIS_20260213_143052
#   策略: basis
#   價差: 170.0 點
#   預期獲利: NT$4,250 / 口
#   風險評分: 85/100

# 步驟 2: 執行交易
python3 scripts/trader.py \
  --opportunity-id BASIS_20260213_143052 \
  --quantity 3

# 輸出：
# ✅ 風險檢查通過
# 📤 開始執行訂單...
# ✅ 訂單已送出: SELL 3 口 TXF @ 21,850
# ✅ 訂單已送出: BUY 600 股 0050 @ 182.5
```

### 場景 2：24/7 自動交易

```bash
# 啟動自動交易引擎
python3 scripts/autotrader.py \
  --strategies basis,calendar \
  --max-positions 10

# 系統會自動：
# 1. 每 30 秒掃描一次市場
# 2. 發現符合條件的套利機會
# 3. 執行風險檢查
# 4. 自動下單
# 5. 監控倉位
# 6. 觸發止損/止盈自動平倉
```

輸出示例：
```
🚀 自動交易引擎啟動
啟用策略: ['basis', 'calendar']
最大倉位: 10

第 1 次掃描 - 14:30:52
📊 當前持倉: 0/10
  期現價差: 165.0 點
🎯 發現最佳機會:
  策略: basis
  預期獲利: NT$4,100
✅ 風險檢查通過
建議倉位: 2 口
📤 執行交易...
✅ 交易執行成功！

⏳ 等待 30 秒後下次掃描...
```

## 🔧 配置說明

### 策略參數 (`config/settings.json`)

```json
{
  "strategies": {
    "basis_arbitrage": {
      "enabled": true,
      "min_spread": 150,      // 最小價差門檻（點）
      "max_spread": 300,      // 最大價差上限
      "exit_spread": 30       // 出場價差目標
    },
    "calendar_spread": {
      "enabled": true,
      "threshold": -30,       // 逆價差觸發門檻
      "target_spread": 35     // 目標正價差
    }
  },
  
  "risk_management": {
    "max_drawdown_percent": 5,     // 最大回撤 5%
    "daily_loss_limit": 10000,     // 每日停損 NT$10,000
    "max_positions": 10,           // 最大持倉數
    "stop_loss_points": 100,       // 單筆止損 100 點
    "take_profit_points": 200      // 單筆止盈 200 點
  }
}
```

## 📈 績效追蹤

### 查看交易記錄

```bash
# 查看所有交易
cat data/trades.json

# 查看日誌
tail -f data/logs/autotrader.log
```

### 生成報告（功能待開發）

```bash
python3 scripts/report.py --period 30d --export pdf
```

## ⚠️ 風險管理

系統內建多層風險控制：

### 1. 開倉前檢查
- ✅ 最大倉位數限制
- ✅ 單筆規模限制
- ✅ 保證金充足性檢查
- ✅ 當日虧損限制

### 2. 持倉中監控
- ✅ 實時止損（100 點）
- ✅ 實時止盈（200 點）
- ✅ 保證金追繳警示

### 3. 系統級熔斷
- ✅ 當日虧損達 NT$10,000 自動停止
- ✅ 最大回撤超過 5% 暫停交易
- ✅ 異常價格過濾

## 🧪 測試與除錯

### 模擬模式

```bash
# 在配置中設置 simulation: true
{
  "shioaji": {
    "simulation": true  // 使用永豐模擬帳戶
  }
}
```

### Dry Run 模式

```bash
# 掃描但不下單
python3 scripts/trader.py \
  --opportunity-id BASIS_20260213_143052 \
  --dry-run

# 輸出：
# 🧪 【模擬模式】不實際下單
# === 模擬交易執行 ===
# ...
```

## 📚 進階功能

### 整合 Telegram 通知

```json
{
  "notifications": {
    "telegram_enabled": true,
    "telegram_bot_token": "YOUR_BOT_TOKEN",
    "telegram_chat_id": "YOUR_CHAT_ID"
  }
}
```

### 自定義交易邏輯

編輯 `lib/spread_calculator.py`：

```python
def calculate_basis_spread(self, futures_price, spot_index, days_to_expiry):
    # 添加您自己的計算邏輯
    custom_threshold = self._my_custom_analysis()
    return {...}
```

## 🐛 常見問題

### Q: 無法登入 API

```bash
# 檢查憑證
cat config/settings.json

# 測試連線
python3 -c "from lib.shioaji_client import ShioajiClient; client = ShioajiClient(); client.login()"
```

### Q: 找不到套利機會

調低價差門檻：
```bash
python3 scripts/scanner.py --threshold 100
```

### Q: 交易失敗

檢查：
1. 保證金是否充足
2. 是否在交易時段
3. 合約代碼是否正確
4. API 限流是否達到

## 📞 支援與回饋

- **GitHub Issues**: [Report Bug](https://github.com/your-repo/issues)
- **Telegram 社群**: [加入討論](https://t.me/your-group)
- **Email**: your-email@example.com

## ⚖️ 免責聲明

**本系統僅供教育和研究用途**

- 期貨交易涉及重大財務風險
- 過去績效不代表未來表現
- 請勿投入您無法承受損失的資金
- 建議先使用模擬帳戶測試
- 實盤交易前請諮詢專業顧問
- 作者不對任何交易損失負責

## 📄 授權

MIT License - 詳見 LICENSE 文件

---

**祝您交易順利！** 🚀📈
