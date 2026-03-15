#!/usr/bin/env python3
"""
自動交易引擎
24/7 監控市場並自動執行套利交易
"""

import sys
import os
import json
import argparse
import logging
import time
import signal
from datetime import datetime, time as dt_time
from typing import List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.shioaji_client import ShioajiClient
from lib.spread_calculator import SpreadCalculator, ArbitrageOpportunity
from lib.risk_manager import RiskManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data/logs/autotrader.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class AutoTrader:
    """自動交易引擎"""
    
    def __init__(self, config_path: str = "config/settings.json"):
        """初始化自動交易器"""
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        self.client = ShioajiClient(config_path)
        self.calculator = SpreadCalculator()
        self.risk_manager = RiskManager(self.config)
        
        self.running = False
        self.paused = False
        
        self.enabled_strategies = []
        self.max_positions = self.config['trading']['max_positions']
        
        # 性能統計
        self.stats = {
            'start_time': None,
            'scans': 0,
            'opportunities_found': 0,
            'trades_executed': 0,
            'total_profit': 0.0
        }
    
    def start(self, strategies: List[str], continuous: bool = True):
        """
        啟動自動交易
        
        Args:
            strategies: 啟用的策略列表
            continuous: 是否持續運行
        """
        self.enabled_strategies = strategies
        self.running = True
        self.stats['start_time'] = datetime.now()
        
        logger.info("=" * 60)
        logger.info("🚀 自動交易引擎啟動")
        logger.info(f"啟用策略: {strategies}")
        logger.info(f"最大倉位: {self.max_positions}")
        logger.info(f"持續運行: {'是' if continuous else '否'}")
        logger.info("=" * 60)
        
        # 註冊信號處理器
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # 登入 API
        if not self.client.login():
            logger.error("❌ 無法登入 Shioaji API")
            return
        
        try:
            if continuous:
                self._continuous_mode()
            else:
                self._single_scan()
        
        finally:
            self.client.logout()
            self._print_final_stats()
    
    def _continuous_mode(self):
        """持續監控模式"""
        logger.info("📡 進入持續監控模式...")
        
        scan_interval = 30  # 每 30 秒掃描一次
        
        while self.running:
            try:
                # 檢查是否在交易時段
                if not self._is_trading_hours():
                    logger.info("⏸️  非交易時段，等待中...")
                    time.sleep(300)  # 等待 5 分鐘
                    continue
                
                # 檢查是否暫停
                if self.paused:
                    logger.info("⏸️  交易已暫停")
                    time.sleep(60)
                    continue
                
                # 檢查風險狀態
                allowed, reason = self.risk_manager.is_trading_allowed()
                if not allowed:
                    logger.warning(f"⚠️  {reason}")
                    time.sleep(60)
                    continue
                
                # 執行掃描
                self._scan_and_execute()
                
                # 等待下次掃描
                logger.info(f"⏳ 等待 {scan_interval} 秒後下次掃描...")
                time.sleep(scan_interval)
            
            except Exception as e:
                logger.error(f"❌ 運行錯誤: {str(e)}")
                time.sleep(60)
    
    def _single_scan(self):
        """單次掃描模式"""
        logger.info("🔍 執行單次掃描...")
        self._scan_and_execute()
    
    def _scan_and_execute(self):
        """掃描並執行套利"""
        self.stats['scans'] += 1
        
        logger.info(f"\n{'='*60}")
        logger.info(f"第 {self.stats['scans']} 次掃描 - {datetime.now().strftime('%H:%M:%S')}")
        logger.info(f"{'='*60}")
        
        # 檢查當前持倉
        current_positions = len(self.risk_manager.current_positions)
        logger.info(f"📊 當前持倉: {current_positions}/{self.max_positions}")
        
        if current_positions >= self.max_positions:
            logger.warning("⚠️  已達最大持倉數，跳過本次掃描")
            return
        
        # 掃描機會
        opportunities = []
        
        try:
            if 'basis' in self.enabled_strategies:
                opp = self._scan_basis()
                if opp:
                    opportunities.append(opp)
            
            if 'calendar' in self.enabled_strategies:
                opp = self._scan_calendar()
                if opp:
                    opportunities.append(opp)
            
            if 'triangle' in self.enabled_strategies:
                opp = self._scan_triangle()
                if opp:
                    opportunities.append(opp)
        
        except Exception as e:
            logger.error(f"❌ 掃描失敗: {str(e)}")
            return
        
        # 處理發現的機會
        if not opportunities:
            logger.info("⏭️  未發現套利機會")
            return
        
        self.stats['opportunities_found'] += len(opportunities)
        
        # 依風險評分排序
        opportunities.sort(key=lambda x: x.risk_score, reverse=True)
        
        # 執行最佳機會
        best_opportunity = opportunities[0]
        logger.info(f"\n🎯 發現最佳機會:")
        logger.info(f"  策略: {best_opportunity.strategy}")
        logger.info(f"  價差: {best_opportunity.spread:.1f} 點")
        logger.info(f"  預期獲利: NT${best_opportunity.expected_profit:.0f}")
        logger.info(f"  風險評分: {best_opportunity.risk_score}/100")
        
        # 執行交易
        success = self._execute_opportunity(best_opportunity)
        
        if success:
            self.stats['trades_executed'] += 1
            self.stats['total_profit'] += best_opportunity.expected_profit
    
    def _scan_basis(self) -> ArbitrageOpportunity:
        """掃描期現價差"""
        try:
            txf_price = self.client.get_futures_price("TXF")
            spot_index = self.client.get_spot_index()
            
            if not txf_price or not spot_index:
                return None
            
            spread = txf_price - spot_index
            logger.info(f"  期現價差: {spread:.1f} 點")
            
            config = self.config['strategies']['basis_arbitrage']
            
            if abs(spread) >= config['min_spread']:
                market_data = {
                    'futures_price': txf_price,
                    'spot_index': spot_index,
                    'days_to_expiry': 7
                }
                
                return self.calculator.generate_opportunity(
                    strategy='basis',
                    market_data=market_data,
                    config=config
                )
        
        except Exception as e:
            logger.error(f"❌ 期現掃描失敗: {str(e)}")
        
        return None
    
    def _scan_calendar(self) -> ArbitrageOpportunity:
        """掃描跨月價差"""
        # 簡化實現
        return None
    
    def _scan_triangle(self) -> ArbitrageOpportunity:
        """掃描三角套利"""
        # 簡化實現
        return None
    
    def _execute_opportunity(self, opportunity: ArbitrageOpportunity) -> bool:
        """執行套利機會"""
        logger.info("\n📤 準備執行套利交易...")
        
        # 最終風險檢查
        account = self.client.get_account_balance()
        if not account:
            logger.error("❌ 無法獲取帳戶資訊")
            return False
        
        # 計算建議倉位
        quantity = self.risk_manager.calculate_position_size(
            account['total_equity']
        )
        
        can_trade, reason = self.risk_manager.can_open_position(quantity, account)
        
        if not can_trade:
            logger.warning(f"⚠️  風險檢查失敗: {reason}")
            return False
        
        logger.info(f"✅ 風險檢查通過")
        logger.info(f"建議倉位: {quantity} 口")
        
        # 執行訂單（簡化實現）
        logger.info("⚠️  實際下單功能需要完整實現")
        logger.info(f"模擬執行: {opportunity.strategy} x{quantity}")
        
        # 記錄倉位
        self.risk_manager.update_position({
            'id': opportunity.id,
            'strategy': opportunity.strategy,
            'quantity': quantity,
            'entry_time': datetime.now(),
            'entry_price': list(opportunity.contracts.values())[0]
        })
        
        return True
    
    def _is_trading_hours(self) -> bool:
        """檢查是否在交易時段"""
        now = datetime.now()
        current_time = now.time()
        
        # 台股期貨交易時間：
        # 日盤: 08:45 - 13:45
        # 夜盤: 15:00 - 05:00 (次日)
        
        day_start = dt_time(8, 45)
        day_end = dt_time(13, 45)
        night_start = dt_time(15, 0)
        
        # 日盤時段
        if day_start <= current_time <= day_end:
            return True
        
        # 夜盤時段
        if current_time >= night_start or current_time <= dt_time(5, 0):
            return True
        
        return False
    
    def _signal_handler(self, signum, frame):
        """處理中斷信號"""
        logger.info("\n⚠️  收到中斷信號，準備停止...")
        self.running = False
    
    def pause(self):
        """暫停交易"""
        self.paused = True
        logger.info("⏸️  交易已暫停")
    
    def resume(self):
        """恢復交易"""
        self.paused = False
        logger.info("▶️  交易已恢復")
    
    def _print_final_stats(self):
        """打印最終統計"""
        runtime = datetime.now() - self.stats['start_time']
        
        logger.info("\n" + "=" * 60)
        logger.info("📊 最終統計")
        logger.info("=" * 60)
        logger.info(f"運行時間: {runtime}")
        logger.info(f"掃描次數: {self.stats['scans']}")
        logger.info(f"發現機會: {self.stats['opportunities_found']}")
        logger.info(f"執行交易: {self.stats['trades_executed']}")
        logger.info(f"累計獲利: NT${self.stats['total_profit']:.0f}")
        logger.info("=" * 60)


def main():
    """主程式"""
    parser = argparse.ArgumentParser(description='台股期貨自動交易引擎')
    parser.add_argument(
        '--strategies',
        default='basis',
        help='啟用的策略（逗號分隔），例如: basis,calendar'
    )
    parser.add_argument(
        '--max-positions',
        type=int,
        help='最大持倉數（覆蓋配置）'
    )
    parser.add_argument(
        '--action',
        choices=['start', 'pause', 'resume'],
        default='start',
        help='執行動作'
    )
    parser.add_argument(
        '--single-scan',
        action='store_true',
        help='只執行單次掃描（測試用）'
    )
    
    args = parser.parse_args()
    
    # 解析策略
    strategies = [s.strip() for s in args.strategies.split(',')]
    
    # 創建自動交易器
    trader = AutoTrader()
    
    # 覆蓋配置
    if args.max_positions:
        trader.max_positions = args.max_positions
    
    # 執行動作
    if args.action == 'start':
        logger.info("🚀 啟動自動交易引擎...")
        trader.start(
            strategies=strategies,
            continuous=not args.single_scan
        )
    elif args.action == 'pause':
        logger.info("⏸️  暫停交易...")
        trader.pause()
    elif args.action == 'resume':
        logger.info("▶️  恢復交易...")
        trader.resume()


if __name__ == "__main__":
    main()
