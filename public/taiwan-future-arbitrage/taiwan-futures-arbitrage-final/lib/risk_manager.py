"""
風險管理模組
控制倉位、止損、保證金等風險
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class RiskLimits:
    """風險限制參數"""
    max_positions: int = 10
    max_position_size: int = 5
    daily_loss_limit: float = 10000
    max_drawdown_percent: float = 5.0
    margin_buffer_percent: float = 20.0
    stop_loss_points: float = 100
    take_profit_points: float = 200


class RiskManager:
    """風險管理器"""
    
    def __init__(self, config: Dict):
        """初始化風險管理器"""
        self.limits = RiskLimits(**config.get('risk_management', {}))
        self.trading_config = config.get('trading', {})
        
        # 當日統計
        self.daily_pnl = 0.0
        self.daily_trades = 0
        self.current_positions = []
        self.trade_history = []
        
        # 高水位標記
        self.high_water_mark = 0.0
        self.current_equity = 0.0
        
    def can_open_position(
        self,
        quantity: int,
        account_balance: Dict
    ) -> tuple[bool, str]:
        """
        檢查是否可以開倉
        
        Returns:
            (是否可開倉, 原因說明)
        """
        # 檢查1: 倉位數量限制
        if len(self.current_positions) >= self.limits.max_positions:
            return False, f"已達最大倉位數 {self.limits.max_positions}"
        
        # 檢查2: 單筆倉位規模限制
        if quantity > self.limits.max_position_size:
            return False, f"超過單筆最大口數 {self.limits.max_position_size}"
        
        # 檢查3: 當日虧損限制
        if self.daily_pnl < -self.limits.daily_loss_limit:
            return False, f"觸發當日停損線 NT${self.limits.daily_loss_limit}"
        
        # 檢查4: 保證金充足性
        margin_required = self._calculate_margin_required(quantity)
        margin_available = account_balance.get('available_balance', 0)
        
        # 保留緩衝空間
        buffer = margin_required * (self.limits.margin_buffer_percent / 100)
        total_required = margin_required + buffer
        
        if margin_available < total_required:
            return False, f"保證金不足 (需要: NT${total_required:.0f}, 可用: NT${margin_available:.0f})"
        
        # 檢查5: 最大回撤限制
        if self.current_equity > 0:
            drawdown_percent = (
                (self.high_water_mark - self.current_equity) / self.high_water_mark * 100
            )
            
            if drawdown_percent > self.limits.max_drawdown_percent:
                return False, f"超過最大回撤限制 {self.limits.max_drawdown_percent}%"
        
        return True, "通過風險檢查"
    
    def _calculate_margin_required(self, quantity: int) -> float:
        """
        計算所需保證金
        
        台指期每口約 NT$200,000 保證金（依交易所規定）
        """
        margin_per_contract = 200000  # 台指期保證金
        return margin_per_contract * quantity
    
    def calculate_position_size(
        self,
        account_balance: float,
        risk_per_trade: float = 0.02  # 每筆交易風險 2%
    ) -> int:
        """
        根據 Kelly 公式計算最佳倉位
        
        Args:
            account_balance: 帳戶餘額
            risk_per_trade: 單筆交易風險百分比
        
        Returns:
            建議倉位（口數）
        """
        # 簡化版 Kelly 公式
        # f* = (bp - q) / b
        # 其中 b = 賠率, p = 勝率, q = 敗率
        
        # 基於歷史數據估算
        win_rate = 0.75  # 假設 75% 勝率
        avg_win = 2500  # 平均獲利 NT$2,500
        avg_loss = 1000  # 平均虧損 NT$1,000
        
        # Kelly 百分比
        kelly_fraction = (win_rate * avg_win - (1 - win_rate) * avg_loss) / avg_win
        
        # 使用保守的 Kelly 分數（25% Kelly）
        conservative_kelly = kelly_fraction * 0.25
        
        # 計算倉位
        risk_amount = account_balance * risk_per_trade
        position_size = int(risk_amount / (avg_loss * conservative_kelly))
        
        # 限制在最大倉位內
        return min(position_size, self.limits.max_position_size)
    
    def check_stop_loss(
        self,
        entry_price: float,
        current_price: float,
        direction: str  # 'long' or 'short'
    ) -> bool:
        """
        檢查是否觸發止損
        
        Returns:
            True if 應該止損
        """
        if direction == 'long':
            loss_points = entry_price - current_price
        else:  # short
            loss_points = current_price - entry_price
        
        if loss_points > self.limits.stop_loss_points:
            logger.warning(f"⚠️ 觸發止損！虧損 {loss_points} 點")
            return True
        
        return False
    
    def check_take_profit(
        self,
        entry_price: float,
        current_price: float,
        direction: str
    ) -> bool:
        """
        檢查是否觸發止盈
        
        Returns:
            True if 應該止盈
        """
        if direction == 'long':
            profit_points = current_price - entry_price
        else:  # short
            profit_points = entry_price - current_price
        
        if profit_points > self.limits.take_profit_points:
            logger.info(f"✅ 觸發止盈！獲利 {profit_points} 點")
            return True
        
        return False
    
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
    
    def close_position(self, position_id: str, pnl: float):
        """平倉並更新統計"""
        self.current_positions = [
            p for p in self.current_positions if p['id'] != position_id
        ]
        
        # 更新當日盈虧
        self.daily_pnl += pnl
        self.daily_trades += 1
        
        # 更新權益和高水位
        self.current_equity += pnl
        if self.current_equity > self.high_water_mark:
            self.high_water_mark = self.current_equity
        
        # 記錄歷史
        self.trade_history.append({
            'timestamp': datetime.now(),
            'position_id': position_id,
            'pnl': pnl
        })
        
        logger.info(f"📊 平倉: {position_id}, 盈虧: NT${pnl:.0f}")
        logger.info(f"📊 當日盈虧: NT${self.daily_pnl:.0f}, 交易次數: {self.daily_trades}")
    
    def reset_daily_stats(self):
        """重置當日統計（每日開盤時呼叫）"""
        logger.info(f"📊 昨日總結 - 盈虧: NT${self.daily_pnl:.0f}, 交易: {self.daily_trades} 筆")
        
        self.daily_pnl = 0.0
        self.daily_trades = 0
    
    def get_risk_report(self) -> Dict:
        """獲取風險報告"""
        total_exposure = len(self.current_positions) * 200000  # 簡化計算
        
        drawdown = 0.0
        if self.high_water_mark > 0:
            drawdown = (self.high_water_mark - self.current_equity) / self.high_water_mark * 100
        
        return {
            'current_positions': len(self.current_positions),
            'max_positions': self.limits.max_positions,
            'daily_pnl': self.daily_pnl,
            'daily_loss_limit': self.limits.daily_loss_limit,
            'remaining_capacity': self.limits.daily_loss_limit + self.daily_pnl,
            'total_exposure': total_exposure,
            'current_drawdown_percent': drawdown,
            'max_drawdown_percent': self.limits.max_drawdown_percent,
            'daily_trades': self.daily_trades
        }
    
    def is_trading_allowed(self) -> tuple[bool, str]:
        """
        檢查當前是否允許交易
        
        Returns:
            (是否允許, 原因)
        """
        # 檢查熔斷機制
        if self.daily_pnl < -self.limits.daily_loss_limit:
            return False, "觸發當日停損熔斷"
        
        # 檢查最大回撤
        if self.high_water_mark > 0:
            drawdown = (self.high_water_mark - self.current_equity) / self.high_water_mark * 100
            if drawdown > self.limits.max_drawdown_percent:
                return False, f"超過最大回撤限制 {self.limits.max_drawdown_percent}%"
        
        # 檢查是否啟用自動交易
        if not self.trading_config.get('enable_auto_trading', False):
            return False, "自動交易已停用"
        
        return True, "允許交易"


# 測試
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    config = {
        'risk_management': {
            'max_positions': 10,
            'daily_loss_limit': 10000,
            'margin_buffer_percent': 20
        },
        'trading': {
            'enable_auto_trading': True
        }
    }
    
    manager = RiskManager(config)
    
    # 測試開倉檢查
    account = {'available_balance': 1000000}
    can_trade, reason = manager.can_open_position(3, account)
    print(f"可以開倉: {can_trade}, 原因: {reason}")
    
    # 測試倉位計算
    position_size = manager.calculate_position_size(1000000)
    print(f"建議倉位: {position_size} 口")
    
    # 測試風險報告
    report = manager.get_risk_report()
    print(f"風險報告: {report}")
