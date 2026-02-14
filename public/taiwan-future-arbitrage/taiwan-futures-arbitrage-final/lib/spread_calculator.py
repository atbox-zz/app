"""
價差計算引擎
計算各種套利策略的價差和預期收益
"""

from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np
import logging

logger = logging.getLogger(__name__)


@dataclass
class ArbitrageOpportunity:
    """套利機會數據類"""
    id: str
    strategy: str  # 'basis', 'calendar', 'triangle'
    timestamp: datetime
    spread: float
    expected_profit: float
    risk_score: int  # 0-100
    contracts: Dict[str, float]  # {contract: price}
    actions: List[Dict]  # [{action: 'buy/sell', contract: 'TXF', quantity: 1}]
    exit_conditions: Dict
    notes: str = ""


class SpreadCalculator:
    """價差計算器"""
    
    def __init__(self):
        self.txf_multiplier = 200  # 台指期每點價值 NT$200
        self.trading_fee = 60  # 每口手續費約 NT$60
        self.tax_rate = 0.00002  # 期貨交易稅 0.00002
        
    def calculate_basis_spread(
        self,
        futures_price: float,
        spot_index: float,
        days_to_expiry: int = 7
    ) -> Dict:
        """
        計算期現價差套利機會
        
        Args:
            futures_price: 期貨價格
            spot_index: 現貨指數
            days_to_expiry: 距到期日天數
        
        Returns:
            包含價差分析的字典
        """
        # 計算價差
        spread = futures_price - spot_index
        
        # 理論價差 (考慮利率和股息)
        risk_free_rate = 0.015  # 無風險利率 1.5%
        dividend_yield = 0.035  # 股息殖利率 3.5%
        
        theoretical_spread = spot_index * (
            (risk_free_rate - dividend_yield) * (days_to_expiry / 365)
        )
        
        # 價差偏離程度
        spread_deviation = spread - theoretical_spread
        
        # 計算潛在獲利（每口）
        # 假設價差會在到期日收斂至 0
        potential_profit = abs(spread) * self.txf_multiplier
        
        # 扣除交易成本
        total_cost = (
            self.trading_fee * 2 +  # 一買一賣
            futures_price * self.txf_multiplier * self.tax_rate
        )
        
        net_profit = potential_profit - total_cost
        
        # 風險評分 (0-100，100 = 最安全)
        risk_score = self._calculate_risk_score(
            spread_deviation=spread_deviation,
            days_to_expiry=days_to_expiry,
            spread=spread
        )
        
        return {
            'spread': spread,
            'theoretical_spread': theoretical_spread,
            'spread_deviation': spread_deviation,
            'potential_profit_per_contract': net_profit,
            'risk_score': risk_score,
            'days_to_expiry': days_to_expiry,
            'trading_cost': total_cost
        }
    
    def calculate_calendar_spread(
        self,
        near_month_price: float,
        next_month_price: float,
        days_to_near_expiry: int = 7
    ) -> Dict:
        """
        計算跨月價差套利機會
        
        Args:
            near_month_price: 近月合約價格
            next_month_price: 次月合約價格
            days_to_near_expiry: 距近月到期日天數
        
        Returns:
            包含跨月價差分析的字典
        """
        # 計算價差
        spread = next_month_price - near_month_price
        
        # 理論上，次月應該高於近月（正價差）
        # 如果出現逆價差（spread < 0），就是套利機會
        
        # 預期價差回歸至正常值（歷史平均約 30-40 點）
        normal_spread = 35  # 點
        
        # 潛在獲利
        spread_change = normal_spread - spread
        potential_profit = abs(spread_change) * self.txf_multiplier
        
        # 扣除交易成本（跨月套利需要雙邊交易）
        total_cost = self.trading_fee * 2 * 2  # 4 次交易（進場和出場各兩筆）
        net_profit = potential_profit - total_cost
        
        # 風險評分
        risk_score = 90 if spread < -20 else 70  # 逆價差越大，機會越好
        
        return {
            'spread': spread,
            'normal_spread': normal_spread,
            'spread_deviation': spread - normal_spread,
            'potential_profit_per_contract': net_profit,
            'risk_score': risk_score,
            'strategy': 'buy_next_sell_near' if spread < 0 else 'wait'
        }
    
    def calculate_triangle_arbitrage(
        self,
        txf_price: float,
        te_price: float,
        tf_price: float
    ) -> Dict:
        """
        計算三角套利機會（台指期 vs 電子期 vs 金融期）
        
        Args:
            txf_price: 台指期價格
            te_price: 電子期價格
            tf_price: 金融期價格
        
        Returns:
            包含三角套利分析的字典
        """
        # 台指的理論價格應該約等於：
        # 電子期 * 0.65 + 金融期 * 0.35 (依據指數編製比例)
        
        theoretical_txf = te_price * 0.65 + tf_price * 0.35
        
        # 價差
        spread = txf_price - theoretical_txf
        
        # 潛在獲利
        potential_profit = abs(spread) * self.txf_multiplier
        
        # 交易成本（需要 3 筆交易）
        total_cost = self.trading_fee * 3
        net_profit = potential_profit - total_cost
        
        # 風險評分
        risk_score = 85 if abs(spread) > 50 else 60
        
        return {
            'spread': spread,
            'theoretical_txf': theoretical_txf,
            'actual_txf': txf_price,
            'potential_profit_per_contract': net_profit,
            'risk_score': risk_score,
            'te_weight': 0.65,
            'tf_weight': 0.35
        }
    
    def _calculate_risk_score(
        self,
        spread_deviation: float,
        days_to_expiry: int,
        spread: float
    ) -> int:
        """
        計算風險評分
        
        Returns:
            0-100 的風險評分，100 = 最安全
        """
        score = 50  # 基準分
        
        # 價差偏離越大，機會越好
        if abs(spread_deviation) > 100:
            score += 30
        elif abs(spread_deviation) > 50:
            score += 20
        
        # 距到期日越近，收斂機率越高
        if days_to_expiry < 3:
            score += 20
        elif days_to_expiry < 7:
            score += 10
        
        # 價差方向（正價差過大 vs 逆價差）
        if spread > 150:  # 正價差過大
            score += 15
        
        # 確保在 0-100 範圍內
        return min(100, max(0, score))
    
    def generate_opportunity(
        self,
        strategy: str,
        market_data: Dict,
        config: Dict
    ) -> Optional[ArbitrageOpportunity]:
        """
        產生套利機會物件
        
        Args:
            strategy: 策略類型
            market_data: 市場數據
            config: 策略配置
        
        Returns:
            ArbitrageOpportunity 或 None
        """
        if strategy == 'basis':
            analysis = self.calculate_basis_spread(
                futures_price=market_data['futures_price'],
                spot_index=market_data['spot_index'],
                days_to_expiry=market_data.get('days_to_expiry', 7)
            )
            
            # 檢查是否符合進場條件
            if abs(analysis['spread']) < config['min_spread']:
                return None
            
            opportunity_id = f"BASIS_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            return ArbitrageOpportunity(
                id=opportunity_id,
                strategy='basis',
                timestamp=datetime.now(),
                spread=analysis['spread'],
                expected_profit=analysis['potential_profit_per_contract'],
                risk_score=analysis['risk_score'],
                contracts={
                    'TXF': market_data['futures_price'],
                    'SPOT': market_data['spot_index']
                },
                actions=[
                    {'action': 'sell', 'contract': 'TXF', 'quantity': 1},
                    {'action': 'buy', 'contract': '0050', 'quantity': 200}  # ETF 代理
                ],
                exit_conditions={
                    'target_spread': config['exit_spread'],
                    'days_to_expiry': 0
                },
                notes=f"價差 {analysis['spread']:.1f} 點，預期獲利 NT${analysis['potential_profit_per_contract']:.0f}"
            )
        
        elif strategy == 'calendar':
            analysis = self.calculate_calendar_spread(
                near_month_price=market_data['near_month'],
                next_month_price=market_data['next_month']
            )
            
            # 只在逆價差時進場
            if analysis['spread'] >= config['threshold']:
                return None
            
            opportunity_id = f"CALENDAR_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            return ArbitrageOpportunity(
                id=opportunity_id,
                strategy='calendar',
                timestamp=datetime.now(),
                spread=analysis['spread'],
                expected_profit=analysis['potential_profit_per_contract'],
                risk_score=analysis['risk_score'],
                contracts={
                    'TXF1': market_data['near_month'],
                    'TXF2': market_data['next_month']
                },
                actions=[
                    {'action': 'buy', 'contract': 'TXF2', 'quantity': 1},
                    {'action': 'sell', 'contract': 'TXF1', 'quantity': 1}
                ],
                exit_conditions={
                    'target_spread': config['target_spread'],
                    'max_holding_days': 14
                },
                notes=f"跨月逆價差 {analysis['spread']:.1f} 點，預期收斂至 {analysis['normal_spread']} 點"
            )
        
        return None


# 測試用例
if __name__ == "__main__":
    calc = SpreadCalculator()
    
    # 測試期現價差
    result = calc.calculate_basis_spread(
        futures_price=21850,
        spot_index=21680,
        days_to_expiry=5
    )
    
    print("期現價差分析:")
    for key, value in result.items():
        print(f"  {key}: {value}")
    
    # 測試跨月價差
    calendar_result = calc.calculate_calendar_spread(
        near_month_price=21850,
        next_month_price=21820
    )
    
    print("\n跨月價差分析:")
    for key, value in calendar_result.items():
        print(f"  {key}: {value}")
