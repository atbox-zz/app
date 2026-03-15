#!/usr/bin/env python3
"""
套利交易執行器
執行套利交易並監控倉位
"""

import sys
import os
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.shioaji_client import ShioajiClient
from lib.risk_manager import RiskManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ArbitrageTrader:
    """套利交易執行器"""
    
    def __init__(self, config_path: str = "config/settings.json"):
        """初始化交易器"""
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        self.client = ShioajiClient(config_path)
        self.risk_manager = RiskManager(self.config)
        
        self.active_positions = {}
    
    def execute_arbitrage(
        self,
        opportunity_id: str,
        quantity: int,
        dry_run: bool = False
    ) -> bool:
        """
        執行套利交易
        
        Args:
            opportunity_id: 套利機會 ID
            quantity: 交易口數
            dry_run: 模擬模式
        
        Returns:
            執行是否成功
        """
        logger.info(f"🎯 準備執行套利交易: {opportunity_id}")
        
        # 載入套利機會資訊
        opportunity = self._load_opportunity(opportunity_id)
        if not opportunity:
            logger.error(f"❌ 找不到套利機會: {opportunity_id}")
            return False
        
        # 登入 API
        if not self.client.login():
            logger.error("❌ 無法登入 Shioaji API")
            return False
        
        try:
            # 風險檢查
            account_balance = self.client.get_account_balance()
            if not account_balance:
                logger.error("❌ 無法獲取帳戶資訊")
                return False
            
            can_trade, reason = self.risk_manager.can_open_position(
                quantity, account_balance
            )
            
            if not can_trade:
                logger.error(f"❌ 風險檢查失敗: {reason}")
                return False
            
            logger.info(f"✅ 風險檢查通過: {reason}")
            
            # 執行雙邊交易
            if dry_run:
                logger.info("🧪 【模擬模式】不實際下單")
                self._simulate_execution(opportunity, quantity)
                return True
            
            # 實際下單
            success = self._execute_orders(opportunity, quantity)
            
            if success:
                logger.info(f"✅ 套利交易執行成功")
                self._record_trade(opportunity, quantity)
            
            return success
        
        finally:
            self.client.logout()
    
    def _load_opportunity(self, opportunity_id: str) -> Optional[Dict]:
        """從檔案載入套利機會"""
        # 掃描 data 目錄下的所有機會文件
        data_dir = "data"
        
        for filename in os.listdir(data_dir):
            if filename.startswith("opportunities_") and filename.endswith(".json"):
                filepath = os.path.join(data_dir, filename)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    opportunities = json.load(f)
                
                for opp in opportunities:
                    if opp['id'] == opportunity_id:
                        return opp
        
        return None
    
    def _execute_orders(self, opportunity: Dict, quantity: int) -> bool:
        """執行訂單"""
        logger.info("📤 開始執行訂單...")
        
        executed_orders = []
        
        try:
            # 依序執行每個動作
            for action in opportunity['actions']:
                contract = action['contract']
                side = action['action']  # 'buy' or 'sell'
                
                # 獲取當前價格作為參考
                if contract == 'TXF':
                    current_price = self.client.get_futures_price('TXF')
                elif contract == '0050':
                    # ETF 需要不同處理
                    logger.warning("⚠️  0050 ETF 下單功能待實現")
                    continue
                else:
                    logger.warning(f"⚠️  不支援的合約: {contract}")
                    continue
                
                if not current_price:
                    raise Exception(f"無法獲取 {contract} 價格")
                
                # 計算限價單價格（市價 ± 1-2 跳）
                tick_size = 1  # 台指期最小跳動
                if side == 'buy':
                    limit_price = current_price + tick_size  # 買進用稍高價
                else:
                    limit_price = current_price - tick_size  # 賣出用稍低價
                
                # 下單
                order_id = self.client.place_order(
                    contract_symbol=contract,
                    action='Buy' if side == 'buy' else 'Sell',
                    quantity=quantity * action['quantity'],  # 依比例調整
                    price=limit_price
                )
                
                if order_id:
                    executed_orders.append({
                        'order_id': order_id,
                        'contract': contract,
                        'action': side,
                        'quantity': quantity * action['quantity'],
                        'price': limit_price
                    })
                    logger.info(f"  ✅ {side.upper()} {contract} x{quantity} @ {limit_price}")
                else:
                    raise Exception(f"{contract} 下單失敗")
            
            # 所有訂單都成功
            logger.info(f"✅ 所有訂單執行完成 ({len(executed_orders)} 筆)")
            
            # 記錄到活動倉位
            self.active_positions[opportunity['id']] = {
                'opportunity_id': opportunity['id'],
                'entry_time': datetime.now(),
                'orders': executed_orders,
                'quantity': quantity,
                'strategy': opportunity['strategy']
            }
            
            return True
        
        except Exception as e:
            logger.error(f"❌ 訂單執行失敗: {str(e)}")
            
            # 嘗試回滾已執行的訂單
            if executed_orders:
                logger.warning("⚠️  嘗試回滾部分成交...")
                self._rollback_orders(executed_orders)
            
            return False
    
    def _rollback_orders(self, orders: list):
        """回滾部分成交的訂單"""
        logger.info("🔄 執行訂單回滾...")
        
        for order in orders:
            # 反向平倉
            reverse_action = 'Sell' if order['action'] == 'buy' else 'Buy'
            
            self.client.place_order(
                contract_symbol=order['contract'],
                action=reverse_action,
                quantity=order['quantity'],
                price=None  # 市價單快速平倉
            )
            
            logger.info(f"  ↩️  平倉 {order['contract']}")
    
    def _simulate_execution(self, opportunity: Dict, quantity: int):
        """模擬執行（用於測試）"""
        logger.info("=== 模擬交易執行 ===")
        logger.info(f"策略: {opportunity['strategy']}")
        logger.info(f"預期獲利: NT${opportunity['expected_profit'] * quantity:.0f}")
        logger.info("\n動作列表:")
        
        for action in opportunity['actions']:
            logger.info(f"  {action['action'].upper()} {action['quantity'] * quantity} 口 {action['contract']}")
        
        logger.info("===================")
    
    def _record_trade(self, opportunity: Dict, quantity: int):
        """記錄交易到資料庫"""
        trade_record = {
            'timestamp': datetime.now().isoformat(),
            'opportunity_id': opportunity['id'],
            'strategy': opportunity['strategy'],
            'quantity': quantity,
            'expected_profit': opportunity['expected_profit'] * quantity,
            'risk_score': opportunity['risk_score'],
            'status': 'OPEN'
        }
        
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
        
        logger.info(f"📝 交易記錄已儲存")


def main():
    """主程式"""
    parser = argparse.ArgumentParser(description='台股期貨套利交易執行器')
    parser.add_argument(
        '--opportunity-id',
        required=True,
        help='套利機會 ID'
    )
    parser.add_argument(
        '--quantity',
        type=int,
        default=1,
        help='交易口數'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='模擬模式（不實際下單）'
    )
    
    args = parser.parse_args()
    
    # 確認模式
    if not args.dry_run:
        confirm = input(f"⚠️  確定要執行實盤交易？(yes/no): ")
        if confirm.lower() != 'yes':
            print("❌ 交易已取消")
            return
    
    # 創建交易器
    trader = ArbitrageTrader()
    
    # 執行交易
    success = trader.execute_arbitrage(
        opportunity_id=args.opportunity_id,
        quantity=args.quantity,
        dry_run=args.dry_run
    )
    
    if success:
        print(f"\n✅ 交易執行{'模擬' if args.dry_run else ''}成功！")
    else:
        print(f"\n❌ 交易執行失敗")
        sys.exit(1)


if __name__ == "__main__":
    main()
