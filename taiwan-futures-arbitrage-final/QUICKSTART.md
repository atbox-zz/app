# 🚀 Taiwan Futures Arbitrage - 快速開始指南

## 📦 安裝步驟（5 分鐘）

### 1. 複製到 OpenClaw Skills 目錄

```bash
# 假設您已安裝 OpenClaw
cd ~/.openclaw/workspace/skills/

# 將此目錄複製到 skills 資料夾
# (或者直接 git clone)
cp -r /path/to/taiwan-futures-arbitrage ./
cd taiwan-futures-arbitrage
```

### 2. 安裝 Python 依賴

```bash
pip install -r requirements.txt

# 或使用 poetry/uv
uv pip install -r requirements.txt
```

### 3. 設定 API 憑證

**方法 A: 互動式設定（推薦）**

```bash
python3 scripts/setup.py
```

按照提示輸入：
- 永豐 API Key 和 Secret Key
- 選擇模擬模式或實盤模式
- 設定風險參數

**方法 B: 手動編輯配置**

編輯 `config/settings.json`：

```json
{
  "shioaji": {
    "simulation": true,
    "api_key": "YOUR_API_KEY",
    "secret_key": "YOUR_SECRET_KEY"
  }
}
```

### 4. 測試連線

```bash
python3 scripts/scanner.py --format text
```

成功會顯示：
```
✅ 成功登入 Shioaji API (模擬: True)
🔍 開始掃描期現價差套利...
```

## 💡 基本使用範例

### 範例 1: 掃描套利機會

```bash
# 掃描所有策略
python3 scripts/scanner.py --strategy all

# 只掃描期現價差，門檻 150 點
python3 scripts/scanner.py --strategy basis --threshold 150

# 輸出為 JSON 格式
python3 scripts/scanner.py --strategy basis --format json
```

### 範例 2: 執行交易（模擬）

```bash
# 先掃描並儲存機會
python3 scripts/scanner.py --save

# 假設發現機會 ID: BASIS_20260213_143052
# 模擬執行 2 口
python3 scripts/trader.py \
  --opportunity-id BASIS_20260213_143052 \
  --quantity 2 \
  --dry-run
```

### 範例 3: 啟動自動交易

```bash
# 單次掃描測試
python3 scripts/autotrader.py --single-scan

# 持續運行（按 Ctrl+C 停止）
python3 scripts/autotrader.py \
  --strategies basis,calendar \
  --max-positions 5
```

## 🤖 在 OpenClaw 中使用

一旦安裝到 OpenClaw skills 目錄，您可以直接通過自然語言控制：

### Telegram 對話範例

```
你: 掃描台指期套利機會
Claude: [執行並顯示結果]
      🎯 發現 1 個套利機會！
      
      【機會 #1】
      策略: basis
      價差: 165.0 點
      預期獲利: NT$4,100 / 口
      風險評分: 85/100
      ID: BASIS_20260213_143052

你: 用 3 口執行這個機會
Claude: [執行交易]
      ✅ 風險檢查通過
      建議倉位: 2 口
      📤 執行交易...
      ✅ 交易執行成功！

你: 啟動自動交易，只用期現價差策略
Claude: [啟動 autotrader.py]
      🚀 自動交易引擎啟動
      啟用策略: ['basis']
      最大倉位: 10
```

## 📋 常用指令速查表

| 功能 | 指令 |
|------|------|
| 初始化設定 | `python3 scripts/setup.py` |
| 掃描機會 | `python3 scripts/scanner.py --strategy basis` |
| 執行交易（模擬） | `python3 scripts/trader.py --opportunity-id XXX --dry-run` |
| 執行交易（實盤） | `python3 scripts/trader.py --opportunity-id XXX --quantity 2` |
| 自動交易（測試） | `python3 scripts/autotrader.py --single-scan` |
| 自動交易（24/7） | `python3 scripts/autotrader.py --strategies basis` |
| 查看日誌 | `tail -f data/logs/autotrader.log` |
| 查看交易記錄 | `cat data/trades.json` |

## ⚡ 預期效果

基於保守估計：

| 策略 | 月交易次數 | 單次收益 | 月收益（5口） |
|------|-----------|---------|-------------|
| 期現價差 | 3-5 次 | NT$2,500 | NT$37,500-62,500 |
| 跨月價差 | 2-3 次 | NT$1,500 | NT$15,000-22,500 |
| **合計** | **5-8 次** | - | **NT$52,500-85,000** |

**年化報酬率**: 18-30% (依初始資金 NT$500,000 計算)

## 🔒 安全提示

1. ✅ **先用模擬帳戶測試 1-2 週**
2. ✅ **小額實盤驗證（NT$100,000）**
3. ✅ **設定嚴格的停損限制**
4. ✅ **定期檢查交易日誌**
5. ⚠️ **不要投入無法承受損失的資金**

## 🐛 遇到問題？

### 常見錯誤排查

```bash
# 錯誤: 無法登入 API
→ 檢查 API Key 是否正確
→ 確認網路連線
→ 查看 config/settings.json

# 錯誤: 找不到套利機會
→ 調低價差門檻: --threshold 100
→ 確認市場是否開盤
→ 檢查策略是否啟用

# 錯誤: 保證金不足
→ 檢查帳戶餘額
→ 減少倉位: --quantity 1
→ 調整 max_position_size
```

## 📞 取得支援

- **GitHub**: [Issues](https://github.com/your-repo/issues)
- **Telegram**: [社群討論](https://t.me/your-group)
- **Email**: support@example.com

---

**祝您交易順利！** 🚀📈
