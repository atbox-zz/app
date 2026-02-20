"""
Telegram 通知模組
發送交易通知到 Telegram
"""

import requests
import json
import logging
from typing import Dict, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class TelegramNotifier:
    """Telegram 通知器"""
    
    def __init__(self, config: Dict):
        """
        初始化通知器
        
        Args:
            config: 包含 telegram_bot_token 和 telegram_chat_id 的配置
        """
        self.enabled = config.get('telegram_enabled', False)
        self.bot_token = config.get('telegram_bot_token', '')
        self.chat_id = config.get('telegram_chat_id', '')
        
        self.alert_on_trade = config.get('alert_on_trade', True)
        self.alert_on_opportunity = config.get('alert_on_opportunity', True)
        self.alert_on_error = config.get('alert_on_error', True)
        
        if not self.enabled:
            logger.info("ℹ️  Telegram 通知已停用")
    
    def send_message(self, message: str, parse_mode: str = 'Markdown') -> bool:
        """
        發送訊息到 Telegram
        
        Args:
            message: 訊息內容
            parse_mode: 訊息格式 (Markdown 或 HTML)
        
        Returns:
            發送是否成功
        """
        if not self.enabled:
            return False
        
        if not self.bot_token or not self.chat_id:
            logger.warning("⚠️  Telegram 憑證未設定")
            return False
        
        try:
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            
            payload = {
                'chat_id': self.chat_id,
                'text': message,
                'parse_mode': parse_mode
            }
            
            response = requests.post(url, json=payload, timeout=10)
            
            if response.status_code == 200:
                logger.info("✅ Telegram 訊息已發送")
                return True
            else:
                logger.error(f"❌ Telegram 發送失敗: {response.text}")
                return False
        
        except Exception as e:
            logger.error(f"❌ Telegram 發送錯誤: {str(e)}")
            return False
    
    def notify_opportunity(self, opportunity: Dict):
        """通知發現套利機會"""
        if not self.alert_on_opportunity:
            return
        
        message = f"""
🎯 *發現套利機會！*

*策略*: {opportunity.get('strategy', 'N/A')}
*價差*: {opportunity.get('spread', 0):.1f} 點
*預期獲利*: NT${opportunity.get('expected_profit', 0):,.0f} / 口
*風險評分*: {opportunity.get('risk_score', 0)}/100
*時間*: {datetime.now().strftime('%H:%M:%S')}

{opportunity.get('notes', '')}

ID: `{opportunity.get('id', 'N/A')}`
"""
        
        self.send_message(message)
    
    def notify_trade_executed(self, trade: Dict):
        """通知交易已執行"""
        if not self.alert_on_trade:
            return
        
        message = f"""
✅ *交易執行成功！*

*策略*: {trade.get('strategy', 'N/A')}
*數量*: {trade.get('quantity', 0)} 口
*預期獲利*: NT${trade.get('expected_profit', 0):,.0f}
*時間*: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

交易 ID: `{trade.get('opportunity_id', 'N/A')}`
"""
        
        self.send_message(message)
    
    def notify_position_closed(self, position: Dict, pnl: float):
        """通知倉位已平倉"""
        if not self.alert_on_trade:
            return
        
        emoji = "📈" if pnl > 0 else "📉"
        status = "獲利" if pnl > 0 else "虧損"
        
        message = f"""
{emoji} *倉位已平倉*

*合約*: {position.get('contract', 'N/A')}
*{status}*: NT${abs(pnl):,.0f}
*持有時間*: {position.get('holding_time', 'N/A')}
*時間*: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        self.send_message(message)
    
    def notify_risk_alert(self, alert_type: str, details: Dict):
        """發送風險警報"""
        if not self.alert_on_error:
            return
        
        alert_messages = {
            'stop_loss': '⛔ *觸發止損！*',
            'daily_loss_limit': '🚨 *達到每日虧損上限！*',
            'margin_warning': '⚠️ *保證金不足警告*',
            'max_drawdown': '📉 *超過最大回撤限制*'
        }
        
        title = alert_messages.get(alert_type, '⚠️ *風險警報*')
        
        message = f"""
{title}

*詳細資訊*:
"""
        
        for key, value in details.items():
            message += f"  • {key}: {value}\n"
        
        message += f"\n*時間*: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        
        self.send_message(message)
    
    def notify_error(self, error_message: str, error_details: Optional[str] = None):
        """通知系統錯誤"""
        if not self.alert_on_error:
            return
        
        message = f"""
❌ *系統錯誤*

*錯誤訊息*: {error_message}

*時間*: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        if error_details:
            message += f"\n*詳細資訊*:\n```\n{error_details}\n```"
        
        self.send_message(message)
    
    def send_daily_summary(self, summary: Dict):
        """發送每日摘要"""
        message = f"""
📊 *每日交易摘要*

*日期*: {datetime.now().strftime('%Y-%m-%d')}

*績效*:
  • 交易次數: {summary.get('trades', 0)} 筆
  • 當日盈虧: NT${summary.get('daily_pnl', 0):,.0f}
  • 勝率: {summary.get('win_rate', 0):.1f}%

*持倉*:
  • 當前持倉: {summary.get('positions', 0)} 口
  • 未實現盈虧: NT${summary.get('unrealized_pnl', 0):,.0f}

*風險*:
  • 保證金使用率: {summary.get('margin_usage', 0):.1f}%
  • 當日最大回撤: {summary.get('max_drawdown', 0):.2f}%
"""
        
        self.send_message(message)
    
    def send_custom_message(self, title: str, content: str):
        """發送自定義訊息"""
        message = f"""
*{title}*

{content}

*時間*: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        self.send_message(message)


# 使用範例
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # 測試配置
    test_config = {
        'telegram_enabled': False,  # 設為 True 並填入真實憑證才會實際發送
        'telegram_bot_token': 'YOUR_BOT_TOKEN',
        'telegram_chat_id': 'YOUR_CHAT_ID',
        'alert_on_trade': True,
        'alert_on_opportunity': True,
        'alert_on_error': True
    }
    
    notifier = TelegramNotifier(test_config)
    
    # 測試通知
    test_opportunity = {
        'id': 'BASIS_TEST_001',
        'strategy': 'basis',
        'spread': 165.0,
        'expected_profit': 4100,
        'risk_score': 85,
        'notes': '價差過大，建議進場'
    }
    
    notifier.notify_opportunity(test_opportunity)
    
    test_trade = {
        'opportunity_id': 'BASIS_TEST_001',
        'strategy': 'basis',
        'quantity': 3,
        'expected_profit': 12300
    }
    
    notifier.notify_trade_executed(test_trade)
