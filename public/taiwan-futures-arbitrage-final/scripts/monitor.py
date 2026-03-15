#!/usr/bin/env python3
"""
倉位監控系統
實時監控持倉、盈虧、風險指標
"""

import sys
import os
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, List
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.shioaji_client import ShioajiClient
from lib.risk_manager import RiskManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PositionMonitor:
    """倉位監控器"""
    
    def __init__(self, config_path: str = "config/settings.json"):
        """初始化監控器"""
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        self.client = ShioajiClient(config_path)
        self.risk_manager = RiskManager(self.config)
        
    def get_current_positions(self) -> List[Dict]:
        """獲取當前所有持倉"""
        try:
            positions = self.client.get_positions()
            
            # 豐富化持倉資訊
            enriched_positions = []
            for pos in positions:
                # 計算未實現盈虧
                if pos['direction'] == 'Long':
                    unrealized_pnl = (pos['current_price'] - pos['price']) * pos['quantity'] * 200
                else:  # Short
                    unrealized_pnl = (pos['price'] - pos['current_price']) * pos['quantity'] * 200
                
                enriched_positions.append({
                    'contract': pos['code'],
                    'direction': pos['direction'],
                    'quantity': pos['quantity'],
                    'entry_price': pos['price'],
                    'current_price': pos['current_price'],
                    'unrealized_pnl': unrealized_pnl,
                    'pnl_percent': (unrealized_pnl / (pos['price'] * 200 * pos['quantity'])) * 100
                })
            
            return enriched_positions
        
        except Exception as e:
            logger.error(f"❌ 獲取持倉失敗: {str(e)}")
            return []
    
    def get_account_summary(self) -> Dict:
        """獲取帳戶摘要"""
        try:
            balance = self.client.get_account_balance()
            positions = self.get_current_positions()
            
            # 計算總盈虧
            total_unrealized_pnl = sum(p['unrealized_pnl'] for p in positions)
            
            # 計算保證金使用率
            margin_used = balance['margin_used']
            total_equity = balance['total_equity']
            margin_utilization = (margin_used / total_equity * 100) if total_equity > 0 else 0
            
            return {
                'timestamp': datetime.now(),
                'available_balance': balance['available_balance'],
                'margin_used': margin_used,
                'total_equity': total_equity,
                'unrealized_pnl': total_unrealized_pnl,
                'margin_utilization_percent': margin_utilization,
                'position_count': len(positions),
                'daily_pnl': self.risk_manager.daily_pnl
            }
        
        except Exception as e:
            logger.error(f"❌ 獲取帳戶摘要失敗: {str(e)}")
            return {}
    
    def display_dashboard(self):
        """顯示監控儀表板"""
        # 登入 API
        if not self.client.login():
            logger.error("❌ 無法登入 Shioaji API")
            return
        
        try:
            # 獲取數據
            account = self.get_account_summary()
            positions = self.get_current_positions()
            risk_report = self.risk_manager.get_risk_report()
            
            # 清屏（可選）
            # os.system('clear' if os.name == 'posix' else 'cls')
            
            # 顯示標題
            print("\n" + "=" * 80)
            print(f"📊 台股期貨套利系統 - 監控儀表板")
            print(f"更新時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 80)
            
            # 帳戶資訊
            print("\n【帳戶資訊】")
            print(f"  總權益: NT${account.get('total_equity', 0):,.0f}")
            print(f"  可用餘額: NT${account.get('available_balance', 0):,.0f}")
            print(f"  已用保證金: NT${account.get('margin_used', 0):,.0f}")
            print(f"  保證金使用率: {account.get('margin_utilization_percent', 0):.1f}%")
            print(f"  未實現盈虧: NT${account.get('unrealized_pnl', 0):,.0f}")
            
            # 當日績效
            print("\n【當日績效】")
            print(f"  當日盈虧: NT${account.get('daily_pnl', 0):,.0f}")
            print(f"  交易次數: {risk_report.get('daily_trades', 0)} 筆")
            print(f"  剩餘虧損額度: NT${risk_report.get('remaining_capacity', 0):,.0f}")
            
            # 持倉明細
            print("\n【持倉明細】")
            print(f"  當前持倉: {len(positions)}/{risk_report.get('max_positions', 0)} 口")
            
            if positions:
                print("\n  合約       方向   數量   進場價    現價     未實現盈虧     盈虧率")
                print("  " + "-" * 75)
                
                for pos in positions:
                    direction_icon = "🔵" if pos['direction'] == 'Long' else "🔴"
                    pnl_icon = "📈" if pos['unrealized_pnl'] > 0 else "📉"
                    
                    print(f"  {pos['contract']:<10} {direction_icon} {pos['direction']:<4} "
                          f"{pos['quantity']:>3} {pos['entry_price']:>8,.0f} "
                          f"{pos['current_price']:>8,.0f} {pnl_icon} "
                          f"NT${pos['unrealized_pnl']:>8,.0f} "
                          f"({pos['pnl_percent']:>+6.2f}%)")
            else:
                print("  目前無持倉")
            
            # 風險指標
            print("\n【風險指標】")
            print(f"  最大回撤: {risk_report.get('current_drawdown_percent', 0):.2f}% "
                  f"(上限: {risk_report.get('max_drawdown_percent', 0):.1f}%)")
            print(f"  當日虧損限制: NT${risk_report.get('daily_loss_limit', 0):,.0f}")
            print(f"  總曝險部位: NT${risk_report.get('total_exposure', 0):,.0f}")
            
            # 交易狀態
            allowed, reason = self.risk_manager.is_trading_allowed()
            status_icon = "✅" if allowed else "🚫"
            print(f"\n【交易狀態】 {status_icon}")
            print(f"  {reason}")
            
            print("\n" + "=" * 80)
        
        finally:
            self.client.logout()
    
    def monitor_realtime(self, refresh_interval: int = 10):
        """實時監控模式"""
        logger.info(f"🔴 啟動實時監控（每 {refresh_interval} 秒更新）")
        logger.info("按 Ctrl+C 停止監控")
        
        try:
            while True:
                self.display_dashboard()
                time.sleep(refresh_interval)
        
        except KeyboardInterrupt:
            print("\n\n⏹️  監控已停止")
    
    def check_stop_loss(self):
        """檢查所有持倉的止損條件"""
        if not self.client.login():
            return
        
        try:
            positions = self.get_current_positions()
            
            for pos in positions:
                # 檢查止損
                should_stop = self.risk_manager.check_stop_loss(
                    entry_price=pos['entry_price'],
                    current_price=pos['current_price'],
                    direction='long' if pos['direction'] == 'Long' else 'short'
                )
                
                if should_stop:
                    logger.warning(f"⚠️  {pos['contract']} 觸發止損！準備平倉...")
                    # 這裡應該執行平倉操作
                    # self.client.place_order(...)
                
                # 檢查止盈
                should_profit = self.risk_manager.check_take_profit(
                    entry_price=pos['entry_price'],
                    current_price=pos['current_price'],
                    direction='long' if pos['direction'] == 'Long' else 'short'
                )
                
                if should_profit:
                    logger.info(f"✅ {pos['contract']} 觸發止盈！準備平倉...")
                    # 執行平倉
        
        finally:
            self.client.logout()
    
    def export_snapshot(self, filename: str = None):
        """導出當前狀態快照"""
        if not filename:
            filename = f"data/snapshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        if not self.client.login():
            return
        
        try:
            snapshot = {
                'timestamp': datetime.now().isoformat(),
                'account': self.get_account_summary(),
                'positions': self.get_current_positions(),
                'risk_report': self.risk_manager.get_risk_report()
            }
            
            # 轉換 datetime 物件為字串
            snapshot['account']['timestamp'] = snapshot['account']['timestamp'].isoformat()
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(snapshot, f, ensure_ascii=False, indent=2)
            
            logger.info(f"💾 快照已儲存至 {filename}")
        
        finally:
            self.client.logout()


def main():
    """主程式"""
    parser = argparse.ArgumentParser(description='台股期貨倉位監控系統')
    parser.add_argument(
        '--mode',
        choices=['dashboard', 'realtime', 'check', 'export'],
        default='dashboard',
        help='監控模式'
    )
    parser.add_argument(
        '--refresh',
        type=int,
        default=10,
        help='實時模式的刷新間隔（秒）'
    )
    
    args = parser.parse_args()
    
    monitor = PositionMonitor()
    
    if args.mode == 'dashboard':
        # 單次顯示儀表板
        monitor.display_dashboard()
    
    elif args.mode == 'realtime':
        # 實時監控
        monitor.monitor_realtime(args.refresh)
    
    elif args.mode == 'check':
        # 檢查止損/止盈
        monitor.check_stop_loss()
    
    elif args.mode == 'export':
        # 導出快照
        monitor.export_snapshot()


if __name__ == "__main__":
    main()
