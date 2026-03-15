#!/usr/bin/env python3
"""
套利機會掃描器
掃描台股期貨市場的套利機會
"""

import sys
import os
import json
import argparse
import logging
from datetime import datetime
from typing import List

# 添加 lib 路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.shioaji_client import ShioajiClient
from lib.spread_calculator import SpreadCalculator, ArbitrageOpportunity
from lib.risk_manager import RiskManager

# 設置日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data/logs/scanner.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class ArbitrageScanner:
    """套利掃描器"""
    
    def __init__(self, config_path: str = "config/settings.json"):
        """初始化掃描器"""
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        
        self.client = ShioajiClient(config_path)
        self.calculator = SpreadCalculator()
        self.risk_manager = RiskManager(self.config)
        
        self.opportunities = []
    
    def scan_basis_arbitrage(self) -> List[ArbitrageOpportunity]:
        """掃描期現價差套利機會"""
        logger.info("🔍 開始掃描期現價差套利...")
        
        opportunities = []
        strategy_config = self.config['strategies']['basis_arbitrage']
        
        if not strategy_config['enabled']:
            logger.info("⏭️  期現價差策略未啟用")
            return opportunities
        
        try:
            # 獲取市場數據
            txf_price = self.client.get_futures_price("TXF")
            spot_index = self.client.get_spot_index()
            
            if not txf_price or not spot_index:
                logger.error("❌ 無法獲取市場數據")
                return opportunities
            
            logger.info(f"📊 台指期: {txf_price:.1f}, 現貨: {spot_index:.1f}")
            
            # 計算價差
            market_data = {
                'futures_price': txf_price,
                'spot_index': spot_index,
                'days_to_expiry': 7  # 簡化，實際需計算
            }
            
            opportunity = self.calculator.generate_opportunity(
                strategy='basis',
                market_data=market_data,
                config=strategy_config
            )
            
            if opportunity:
                opportunities.append(opportunity)
                logger.info(f"✅ 發現期現套利機會: {opportunity.notes}")
            else:
                logger.info(f"⏭️  價差 {txf_price - spot_index:.1f} 點，未達門檻 {strategy_config['min_spread']}")
        
        except Exception as e:
            logger.error(f"❌ 掃描期現價差失敗: {str(e)}")
        
        return opportunities
    
    def scan_calendar_arbitrage(self) -> List[ArbitrageOpportunity]:
        """掃描跨月價差套利機會"""
        logger.info("🔍 開始掃描跨月價差套利...")
        
        opportunities = []
        strategy_config = self.config['strategies']['calendar_spread']
        
        if not strategy_config['enabled']:
            logger.info("⏭️  跨月價差策略未啟用")
            return opportunities
        
        try:
            # 注意：實際需要取得正確的近月/次月合約代碼
            # 這裡簡化處理
            logger.info("⚠️  跨月價差功能需要實際合約代碼，目前跳過")
            
            # 示例代碼（需要實際合約）:
            # near_month = self.client.get_futures_price("TXFF4")  # 2026/02
            # next_month = self.client.get_futures_price("TXFG4")  # 2026/03
            
        except Exception as e:
            logger.error(f"❌ 掃描跨月價差失敗: {str(e)}")
        
        return opportunities
    
    def scan_triangle_arbitrage(self) -> List[ArbitrageOpportunity]:
        """掃描三角套利機會"""
        logger.info("🔍 開始掃描三角套利...")
        
        opportunities = []
        strategy_config = self.config['strategies']['triangle_arbitrage']
        
        if not strategy_config['enabled']:
            logger.info("⏭️  三角套利策略未啟用")
            return opportunities
        
        try:
            # 獲取三個合約價格
            txf_price = self.client.get_futures_price("TXF")
            te_price = self.client.get_futures_price("TE")
            tf_price = self.client.get_futures_price("TF")
            
            if not all([txf_price, te_price, tf_price]):
                logger.error("❌ 無法獲取完整市場數據")
                return opportunities
            
            # 計算三角套利
            analysis = self.calculator.calculate_triangle_arbitrage(
                txf_price, te_price, tf_price
            )
            
            logger.info(f"📊 台指: {txf_price:.1f}, 電子: {te_price:.1f}, 金融: {tf_price:.1f}")
            logger.info(f"📊 理論台指: {analysis['theoretical_txf']:.1f}, 實際價差: {analysis['spread']:.1f}")
            
            if abs(analysis['spread']) > strategy_config['threshold']:
                # 創建套利機會（簡化版）
                logger.info(f"✅ 發現三角套利機會: 價差 {analysis['spread']:.1f} 點")
            else:
                logger.info(f"⏭️  價差 {analysis['spread']:.1f} 點，未達門檻")
        
        except Exception as e:
            logger.error(f"❌ 掃描三角套利失敗: {str(e)}")
        
        return opportunities
    
    def scan_all(self, strategies: List[str] = None) -> List[ArbitrageOpportunity]:
        """
        掃描所有策略
        
        Args:
            strategies: 要掃描的策略列表，None 表示全部
        
        Returns:
            所有發現的套利機會
        """
        if strategies is None:
            strategies = ['basis', 'calendar', 'triangle']
        
        all_opportunities = []
        
        # 登入 API
        if not self.client.login():
            logger.error("❌ 無法登入 Shioaji API")
            return all_opportunities
        
        try:
            # 依序掃描各策略
            if 'basis' in strategies:
                all_opportunities.extend(self.scan_basis_arbitrage())
            
            if 'calendar' in strategies:
                all_opportunities.extend(self.scan_calendar_arbitrage())
            
            if 'triangle' in strategies:
                all_opportunities.extend(self.scan_triangle_arbitrage())
            
            # 依風險評分排序
            all_opportunities.sort(key=lambda x: x.risk_score, reverse=True)
            
            return all_opportunities
        
        finally:
            self.client.logout()
    
    def format_output(
        self,
        opportunities: List[ArbitrageOpportunity],
        format_type: str = 'text'
    ) -> str:
        """
        格式化輸出
        
        Args:
            opportunities: 套利機會列表
            format_type: 輸出格式 (text/telegram/json)
        
        Returns:
            格式化後的字串
        """
        if not opportunities:
            return "⏭️  未發現套利機會"
        
        if format_type == 'json':
            return json.dumps([
                {
                    'id': opp.id,
                    'strategy': opp.strategy,
                    'spread': opp.spread,
                    'expected_profit': opp.expected_profit,
                    'risk_score': opp.risk_score,
                    'notes': opp.notes
                }
                for opp in opportunities
            ], ensure_ascii=False, indent=2)
        
        elif format_type == 'telegram':
            output = f"🎯 發現 {len(opportunities)} 個套利機會！\n\n"
            
            for i, opp in enumerate(opportunities, 1):
                output += f"【機會 #{i}】\n"
                output += f"策略: {opp.strategy}\n"
                output += f"價差: {opp.spread:.1f} 點\n"
                output += f"預期獲利: NT${opp.expected_profit:.0f} / 口\n"
                output += f"風險評分: {opp.risk_score}/100\n"
                output += f"說明: {opp.notes}\n"
                output += f"ID: {opp.id}\n"
                output += "---\n"
            
            return output
        
        else:  # text
            output = f"\n{'='*60}\n"
            output += f"套利機會掃描結果 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            output += f"{'='*60}\n\n"
            
            if not opportunities:
                output += "未發現套利機會\n"
            else:
                output += f"發現 {len(opportunities)} 個套利機會：\n\n"
                
                for i, opp in enumerate(opportunities, 1):
                    output += f"【機會 #{i}】\n"
                    output += f"  ID: {opp.id}\n"
                    output += f"  策略: {opp.strategy}\n"
                    output += f"  時間: {opp.timestamp.strftime('%H:%M:%S')}\n"
                    output += f"  價差: {opp.spread:.1f} 點\n"
                    output += f"  預期獲利: NT${opp.expected_profit:.0f} / 口\n"
                    output += f"  風險評分: {opp.risk_score}/100\n"
                    output += f"  說明: {opp.notes}\n"
                    
                    # 顯示進場行動
                    output += f"  建議動作:\n"
                    for action in opp.actions:
                        output += f"    - {action['action'].upper()} {action['quantity']} 口 {action['contract']}\n"
                    
                    output += "\n"
            
            output += f"{'='*60}\n"
            return output


def main():
    """主程式"""
    parser = argparse.ArgumentParser(description='台股期貨套利掃描器')
    parser.add_argument(
        '--strategy',
        choices=['basis', 'calendar', 'triangle', 'all'],
        default='all',
        help='要掃描的策略'
    )
    parser.add_argument(
        '--threshold',
        type=float,
        help='價差門檻（會覆蓋配置文件）'
    )
    parser.add_argument(
        '--format',
        choices=['text', 'telegram', 'json'],
        default='text',
        help='輸出格式'
    )
    parser.add_argument(
        '--save',
        action='store_true',
        help='儲存結果到文件'
    )
    
    args = parser.parse_args()
    
    # 創建掃描器
    scanner = ArbitrageScanner()
    
    # 如果指定了門檻，更新配置
    if args.threshold:
        scanner.config['strategies']['basis_arbitrage']['min_spread'] = args.threshold
    
    # 確定要掃描的策略
    strategies = ['basis', 'calendar', 'triangle'] if args.strategy == 'all' else [args.strategy]
    
    # 執行掃描
    logger.info(f"🚀 開始掃描套利機會... (策略: {strategies})")
    opportunities = scanner.scan_all(strategies)
    
    # 格式化輸出
    output = scanner.format_output(opportunities, args.format)
    print(output)
    
    # 儲存結果
    if args.save and opportunities:
        filename = f"data/opportunities_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump([
                {
                    'id': opp.id,
                    'strategy': opp.strategy,
                    'timestamp': opp.timestamp.isoformat(),
                    'spread': opp.spread,
                    'expected_profit': opp.expected_profit,
                    'risk_score': opp.risk_score,
                    'contracts': opp.contracts,
                    'actions': opp.actions,
                    'notes': opp.notes
                }
                for opp in opportunities
            ], f, ensure_ascii=False, indent=2)
        
        logger.info(f"💾 結果已儲存至 {filename}")


if __name__ == "__main__":
    main()
