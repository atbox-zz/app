# 草稿: 台灣期貨套利交易系統問題分析

## 分析時間
2026-02-17

## 系統概述
這是一個台灣期貨套利交易系統，使用永豐金證券 Shioaji API。
支援策略：期現價差套利、跨月價差套利、三角套利組件架構：scanner.py (掃描器)、trader.py (交易執行)、autotrader.py (自動交易)、monitor.py (監控)

---

## 發現的問題類別

### 🔴 Critical - 交易邏輯問題

#### 1. 訂單狀態追蹤缺失
**位置**: `scripts/trader.py:157-174`

```python
# 下單
order_id = self.client.place_order(
    contract_symbol=contract,
    action='Buy' if side == 'buy' else 'Sell',
    quantity=quantity * action['quantity'],
    price=limit_price
)

if order_id:
    executed_orders.append({...})
    logger.info(f"✅ {side.upper()} {contract} x{quantity} @ {limit_price}")
```

**核心問題**:
- 下單後立即假設成功，沒有等待訂單確認
- 不檢查訂單狀態（待成交/部分成交/完全成交）
- 可能訂單被拒絕但系統認為已成交
- 沒有處理訂單超時或撤單的情況

**潛在后果**:
- 套利交易不平衡（一邊成交，另一邊失敗）
- 風險暴露失控
- 實際盈虧與預期不符

---

#### 2. 雙邊交易執行不是原子操作
**位置**: `scripts/trader.py:131-174`, `scripts/autotrader.py:273`

```python
# 依序執行每個動作
for action in opportunity['actions']:
    contract = action['contract']
    side = action['action']

    # 獲取價格、下單...
    order_id = self.client.place_order(...)

    if order_id:
        executed_orders.append({...})
    else:
        raise Exception(f"{contract} 下單失敗")
```

**核心問題**:
- 套利交易通常需要同時開立多個相反的倉位來對沖風險
- 這裡是順序執行，不是同步提交
- 如果第二筆訂單失敗，第一筆已經提交並可能成交
- 回滾邏輯過於簡化（`_rollback_orders` line 200-215），不保證成功

**潛在后果**:
- 淨風險暴露（買入期貨但現貨下單失敗）
- 需要人工干預
- 潛在的重大財務損失

---

#### 3. 重複交易風險
**位置**: `scripts/autotrader.py:192-227`, `scripts/scanner.py:250-272`

```python
# opportunity_id 基於時間戳生成
opportunity_id = f"BASIS_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
```

**核心問題**:
- 機會 ID 僅使用秒級時間戳，同一秒內可能重複
- 沒有去重檢查機制，可能執行相同機會多次
- 多個實例運行時（不小心啟動多次）會重複下單
- 沒有交易唯一性保證（如 UUID 或序列號）

**潛在后果**:
- 過度交易
- 保證金超出預期
- 重複手續費

---

### 🔴 Critical - 狀態同步問題

#### 4. 倉位狀態不一致
**位置**: `lib/risk_manager.py:181-191`, `scripts/autotrader.py:150-156`

```python
def update_position(self, position: Dict):
    """更新持倉資訊"""
    existing = False
    for i, pos in enumerate(self.current_positions):
        if pos['id'] == position['id']:
            self.current_positions[i] = position
            existing = True
            break

    if not existing:
        self.current_positions.append(position)
```

**核心問題**:
- 倉位狀態僅在記憶體中，沒有持久化
- 系統重啟後丟失所有倉位資訊
- 沒有定期與券商系統同步
- `risk_manager.current_positions` 是自我維護，可能與實際不符

**具體場景**:
```
1. 系統啟動時從券商讀取倉位 → 初始化到 memory
2. 交易後更新 memory
3. 系統崩潰/重啟
4. 倉位記錄丟失，下次啟動從券商重新讀取
5. 但 trade history、daily_pnl 等統計數據丟失
```

**潛在后果**:
- 風險控制失效（以為沒倉位，實際有）
- 重複開倉
- 統計數據不準確

---

#### 5. 訂單狀態與倉位不同步
**位置**: 跨 `scripts/trader.py` 和 `lib/risk_manager.py`

```python
# trader.py - 下單成功後記錄到 active_positions
self.active_positions[opportunity['id']] = {
    'opportunity_id': opportunity['id'],
    'entry_time': datetime.now(),
    'orders': executed_orders,
    'quantity': quantity,
    'strategy': opportunity['strategy']
}

# 但沒有等待訂單確認或檢查實際成交
# 訂單可能部分成交、完全成交、或失敗
# active_positions 的記錄與券商系統實際倉位可能不一致
```

**核心問題**:
- `active_positions` 是本地記錄，僅在 `trader.py` 實例中
- `risk_manager.current_positions` 是另一個記錄，可能在 `autotrader.py`
- 兩個地方都有倉位記錄，但沒有同步機制
- 沒有定期從券商獲取實際倉位進行校準

---

### 🔴 Critical - 並發與競態條件

#### 6. 無並發保護
**位置**: `scripts/autotrader.py:142-204`

```python
def _scan_and_execute(self):
    # 檢查當前持倉
    current_positions = len(self.risk_manager.current_positions)

    if current_positions >= self.max_positions:
        logger.warning("⚠️  已達最大持倉數，跳過本次掃描")
        return

    # 執行交易
    success = self._execute_opportunity(best_opportunity)

    if success:
        self.stats['trades_executed'] += 1
```

**核心問題**:
- 檢查持倉數後，在執行交易前，其他進程可能改變持倉數
- 如果不小心啟動多個 autotrader 實例，沒有任何鎖定機制
- 沒有文件鎖或進程鎖來確保只有一個實例運行

**潛在后果**:
- 超過最大倉位限制
- 重複下單

---

### 🟠 High - API 整合問題

#### 7. 沒有 API 連接重試和斷線重連機制
**位置**: `lib/shioaji_client.py:29-57`

```python
def login(self) -> bool:
    try:
        self.api = sj.Shioaji(simulation=self.config['simulation'])

        accounts = self.api.login(
            api_key=self.config['api_key'],
            secret_key=self.config['secret_key']
        )

        # 成功後無重試邏輯
        return True

    except Exception as e:
        logger.error(f"❌ 登入失敗: {str(e)}")
        return False  # 直接失敗，沒有重試
```

**核心問題**:
- 登入失敗沒有自動重試
- 運行過程中連線斷開沒有自動重連
- 沒有心跳機制檢測連線狀態
- 下單失敗可能是網路問題，但沒有重試

**潛在后果**:
- 系統停止運行需要人工干預
- 錯過套利機會
- 潛在的財務損失

---

#### 8. 行情數據未緩存，每次都重新訂閱
**位置**: `lib/shioaji_client.py:96-109`

```python
def get_futures_price(self, symbol: str) -> Optional[float]:
    # 訂閱即時報價
    self.api.quote.subscribe(
        contract,
        quote_type=constant.QuoteType.Tick,
        version=constant.QuoteVersion.v1
    )

    # 獲取快照
    snapshot = self.api.snapshots([contract])[0]
    return snapshot.close if snapshot else None
```

**核心問題**:
- 每次調用都訂閱，沒有檢查是否已訂閱
- 達到 Shioaji API 訂閱限制後會失敗
- 沒有訂閱管理和緩存機制
- 頻繁訂閱可能導致 API 限流

---

#### 9. 行情獲取失敗時的錯誤處理不足
**位置**: `scripts/autotrader.py:206-236`, `scripts/scanner.py:59-91`

```python
def _scan_basis(self) -> ArbitrageOpportunity:
    try:
        txf_price = self.client.get_futures_price("TXF")
        spot_index = self.client.get_spot_index()

        if not txf_price or not spot_index:
            return None  # 靜默失敗，沒有記錄原因

        spread = txf_price - spot_index
        # ...
    except Exception as e:
        logger.error(f"❌ 期現掃描失敗: {str(e)}")
        return None
```

**核心問題**:
- 行情獲取失敗返回 None，沒有區分失敗原因
- 部分數據獲取成功（TXF 有價格但 SPOT 沒有）仍返回 None
- 沒有降級策略（使用上一次成功的價格）
- 錯誤後沒有重試機制

**潛在后果**:
- 錯過真實的套利機會
- 難以診斷問題
- 連續失敗時系統失去監控能力

---

### 🟠 High - 風險管理問題

#### 10. 風險檢查點不完整
**位置**: `scripts/autotrader.py:248-267`

```python
def _execute_opportunity(self, opportunity: ArbitrageOpportunity) -> bool:
    # 最終風險檢查
    account = self.client.get_account_balance()
    if not account:
        logger.error("❌ 無法獲取帳戶資訊")
        return False

    can_trade, reason = self.risk_manager.can_open_position(quantity, account)

    if not can_trade:
        logger.warning(f"⚠️  風險檢查失敗: {reason}")
        return False

    # 執行訂單（簡化實現）
    logger.info("⚠️  實際下單功能需要完整實現")
    logger.info(f"模擬執行: {opportunity.strategy} x{quantity}")
```

**核心問題**:
- 風險檢查後，開倉時沒有再次檢查（時間差內帳戶可能變化）
- 沒有檢查流動性（市場深度、成交量）
- 沒有檢查滑點容忍度
- 沒有檢查是否在合約到期日附近

**潯在后果**:
- 以為可以交易但實際不行
- 下單失敗或成交價格不佳

---

#### 11. 止損/止盈邏輯未被自動執行
**位置**: `scripts/monitor.py:185-218`

```python
def check_stop_loss(self):
    for pos in positions:
        should_stop = self.risk_manager.check_stop_loss(
            entry_price=pos['entry_price'],
            current_price=pos['current_price'],
            direction='long' if pos['direction'] == 'Long' else 'short'
        )

        if should_stop:
            logger.warning(f"⚠️  {pos['contract']} 觸發止損！準備平倉...")
            # 這裡應該執行平倉操作
            # self.client.place_order(...)  # ← 註釋掉了！
```

**核心問題**:
- `monitor.py` 檢測到止損/止盈但並未實際執行平倉
- `autotrader.py` 沒有自動監控和執行止損
- 需要人工手動平倉
- 止損可能被跳過，導致巨大損失

**潽在后果**:
- **巨大財務損失**（止損未執行）
- 需要持續人工監控

---

### 🟡 Medium - 配置與數據持久化問題

#### 12. 配置文件不包含實際 API 憑證
**位置**: `config/settings.json:3-7`

```json
"shioaji": {
  "simulation": true,
  "api_key": "",      // ← 空的
  "secret_key": "",   // ← 空的
  "ca_path": "",
  "ca_password": ""
}
```

**核心問題**:
- API 憑證為空，無法實際連線
- 沒有提供配置說明如何填寫
- 將憑證放入配置文件可能有安全風險（應使用環境變數）

---

#### 13. 交易記錄持久化方式簡陋
**位置**: `scripts/trader.py:229-255`

```python
def _record_trade(self, opportunity: Dict, quantity: int):
    trade_record = {...}

    # 儲存到 JSON（簡化版，實際應用應使用資料庫）
    trades_file = "data/trades.json"

    if os.path.exists(trades_file):
        with open(trades_file, 'r', encoding='utf-8') as f:
            trades = json.load(f)
    else:
        trades = []

    trades.append(trade_record)

    with open(trades_file, 'w', encoding='utf-8') as f:
        json.dump(trades, f, ensure_ascii=False, indent=2)
```

**核心問題**:
- 讀寫 JSON 文件不是原子操作
- 並發寫入會導致數據損壞
- 沒有使用資料庫（SQLite/PostgreSQL）
- 沒有交易完整性保證

**潽在后果**:
- 數據損壞/丟失
- 無法查詢和統計
- 無法支援並發

---

#### 14. 統計數據在記憶體中，重啟丟失
**位置**: `lib/risk_manager.py:34-42`

```python
def __init__(self, config: Dict):
    # 當日統計
    self.daily_pnl = 0.0
    self.daily_trades = 0
    self.current_positions = []
    self.trade_history = []

    # 高水位標記
    self.high_water_mark = 0.0
    self.current_equity = 0.0
```

**核心問題**:
- 所有統計在記憶體中
- 系統重啟後全部丟失
- `daily_pnl` 初始化為 0，但實際今日可能已有盈虧
- `trade_history` 沒有持久化

---

### 🟡 Medium - 代碼質量問題

#### 15. 硬編碼數值
**位置**: 多處

```python
# lib/risk_manager.py:95
margin_per_contract = 200000  # 台指期保證金

# lib/spread_calculator.py:34
self.txf_multiplier = 200  # 台指期每點價值 NT$200
self.trading_fee = 60  # 每口手續費約 NT$60

# scripts/autotrader.py:103
scan_interval = 30  # 每 30 秒掃描一次
```

**核心問題**:
- 這些值應該從配置文件讀取
- 交易所規定可能變更
- 硬編碼難以維護

---

#### 16. 錯誤處理不一致
**位置**: 多處

```python
# 有些地方捕捉 Exception 記錄日誌後返回 None
except Exception as e:
    logger.error(f"❌ xxx 失敗: {str(e)}")
    return None

# 有些地方直接拋出異常
if not current_price:
    raise Exception(f"無法獲取 {contract} 價格")
```

**核心問題**:
- 錯誤處理風格不一致
- 沒有自定義異常類型
- 難以根據錯誤類型採取不同處理

---

#### 17. 日誌記錄不足
**位置**: 多處

```python
# 很多關鍵操作沒有詳細日誌
# 例如：訂單提交後沒有記錄訂單 ID、時間戳、預期狀態
# 例如：風險檢查通過沒有記錄檢查的詳細參數
```

**核心問題**:
- 難以審計和診斷問題
- 無法重現交易過程
- 缺乏可觀測性

---

### 🔵 Low - 功能不完整

#### 18. 跨月價差套利未實現
**位置**: `scripts/scanner.py:94-117`, `scripts/autotrader.py:238-241`

```python
def _scan_calendar(self) -> ArbitrageOpportunity:
    """掃描跨月價差"""
    # 簡化實現
    return None  # ← 直接返回 None
```

---

#### 19. 三角套利生成機會未實現
**位置**: `scripts/scanner.py:119-157`

```python
# 有分析但沒有生成 ArbitrageOpportunity 物件
if abs(analysis['spread']) > strategy_config['threshold']:
    # 創建套利機會（簡化版）
    logger.info(f"✅ 發現三角套利機會: 價差 {analysis['spread']:.1f} 點")
    # ← 沒有實際生成物件
```

---

#### 20. ETF 交易功能未實現
**位置**: `scripts/trader.py:138-141`

```python
elif contract == '0050':
    # ETF 需要不同處理
    logger.warning("⚠️  0050 ETF 下單功能待實現")
    continue  # ← 跳過
```

---

## 問題優先順序排序

### 🔴 Critical - 必須立即修復（存在財務風險）

1. **訂單狀態追蹤缺失** - 可能導致交易不平衡
2. **雙邊交易執行不是原子操作** - 風險暴露失控
3. **重複交易風險** - 過度交易
4. **倉位狀態不一致** - 風險控制失效
5. **並發與競態條件** - 超過限制
6. **止損/止盈邏輯未被執行** - **巨大財務損失風險**

### 🟠 High - 應盡快修復（影響可靠性）

7. **沒有 API 連接重試和斷線重連機制**
8. **行情數據未緩存，每次都重新訂閱**
9. **行情獲取失敗時的錯誤處理不足**
10. **風險檢查點不完整**

### 🟡 Medium - 應該修復（影響可維護性）

11. **配置文件不包含實際 API 憑證**
12. **交易記錄持久化方式簡陋**
13. **統計數據在記憶體中，重啟丟失**
14. **硬編碼數值**
15. **錯誤處理不一致**
16. **日誌記錄不足**

### 🔵 Low - 可以延後（功能不完整）

17. **跨月價差套利未實現**
18. **三角套利生成機會未實現**
19. **ETF 交易功能未實現**

---

## 修復建議的高階路線圖

### Phase 1: 緊急修復（Critical 問題）
- 實現訂單狀態追蹤和確認機制
- 實現雙邊交易的原子性或事機機制
- 添加唯一的交易 ID 和去重檢查
- 實現倉位狀態持久化和同步
- 實現進程鎖防止多實例
- **實現自動止損/止盈執行**

### Phase 2: 可靠性增強（High 問題）
- API 重試和斷線重連機制
- 行情訂閱管理和緩存
- 錯誤處理和降級策略
- 完善風險檢查

### Phase 3: 基礎設施（Medium 問題）
- 引入資料庫（SQLite）
- 統計數據持久化
- 配置管理改進
- 日誌增強

### Phase 4: 功能完善（Low 問題）
- 實現跨月套利
- 實現三角套利完整流程
- 實現 ETF 交易
