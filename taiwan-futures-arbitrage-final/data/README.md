# Data 目錄

此目錄用於儲存所有運行時數據。

## 目錄結構

```
data/
├── logs/              # 系統日誌
│   ├── autotrader.log
│   ├── scanner.log
│   └── arbitrage.log
│
├── trades.json        # 交易記錄
├── snapshot_*.json    # 狀態快照
└── opportunities_*.json  # 套利機會記錄
```

## 文件說明

### trades.json
記錄所有已執行的交易，包含：
- 進場/出場時間
- 策略類型
- 數量和價格
- 盈虧

### logs/
包含所有系統日誌，按日期輪轉。

### snapshots/
定期保存的系統狀態快照，用於恢復和分析。

## 注意事項

⚠️ 此目錄的文件包含敏感交易數據，請妥善保管。
⚠️ 建議定期備份 trades.json
⚠️ 日誌文件會自動清理（保留 30 天）
