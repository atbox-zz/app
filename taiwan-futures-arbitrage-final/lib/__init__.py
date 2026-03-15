"""
Taiwan Futures Arbitrage - Core Library

核心模組包含：
- shioaji_client: 永豐 API 封裝
- spread_calculator: 價差計算引擎
- risk_manager: 風險管理系統
- telegram_notifier: Telegram 通知服務
"""

__version__ = "1.0.0"
__author__ = "Taiwan Futures Arbitrage Team"

from .shioaji_client import ShioajiClient
from .spread_calculator import SpreadCalculator, ArbitrageOpportunity
from .risk_manager import RiskManager, RiskLimits
from .telegram_notifier import TelegramNotifier

__all__ = [
    'ShioajiClient',
    'SpreadCalculator',
    'ArbitrageOpportunity',
    'RiskManager',
    'RiskLimits',
    'TelegramNotifier'
]
