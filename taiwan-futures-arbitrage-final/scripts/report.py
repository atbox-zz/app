#!/usr/bin/env python3
"""
績效報告系統
生成交易績效分析報告
"""

import sys
import os
import json
import argparse
import logging
from datetime import datetime, timedelta
from typing import Dict, List
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PerformanceReporter:
    """績效報告生成器"""
    
    def __init__(self):
        """初始化報告器"""
        self.trades_file = "data/trades.json"
        
    def load_trades(self, start_date: datetime = None, end_date: datetime = None) -> List[Dict]:
        """載入交易記錄"""
        if not os.path.exists(self.trades_file):
            logger.warning(f"⚠️  找不到交易記錄檔案: {self.trades_file}")
            return []
        
        with open(self.trades_file, 'r', encoding='utf-8') as f:
            trades = json.load(f)
        
        # 過濾日期範圍
        if start_date or end_date:
            filtered = []
            for trade in trades:
                trade_time = datetime.fromisoformat(trade['timestamp'])
                
                if start_date and trade_time < start_date:
                    continue
                if end_date and trade_time > end_date:
                    continue
                
                filtered.append(trade)
            
            return filtered
        
        return trades
    
    def calculate_metrics(self, trades: List[Dict]) -> Dict:
        """計算績效指標"""
        if not trades:
            return {
                'total_trades': 0,
                'total_profit': 0,
                'win_rate': 0,
                'avg_profit': 0,
                'max_drawdown': 0,
                'sharpe_ratio': 0
            }
        
        # 基本統計
        total_trades = len(trades)
        
        # 計算盈虧（簡化版，實際應該從平倉記錄計算）
        profits = [t.get('expected_profit', 0) for t in trades]
        total_profit = sum(profits)
        
        winning_trades = [p for p in profits if p > 0]
        losing_trades = [p for p in profits if p < 0]
        
        win_rate = len(winning_trades) / total_trades * 100 if total_trades > 0 else 0
        avg_profit = np.mean(profits) if profits else 0
        avg_win = np.mean(winning_trades) if winning_trades else 0
        avg_loss = np.mean(losing_trades) if losing_trades else 0
        
        # 計算最大回撤
        cumulative_pnl = np.cumsum(profits)
        running_max = np.maximum.accumulate(cumulative_pnl)
        drawdowns = cumulative_pnl - running_max
        max_drawdown = abs(np.min(drawdowns)) if len(drawdowns) > 0 else 0
        
        # 計算夏普比率（簡化版）
        if len(profits) > 1:
            returns_std = np.std(profits)
            sharpe_ratio = (avg_profit / returns_std) * np.sqrt(252) if returns_std > 0 else 0
        else:
            sharpe_ratio = 0
        
        # 盈虧比
        profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else 0
        
        return {
            'total_trades': total_trades,
            'total_profit': total_profit,
            'win_rate': win_rate,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'avg_profit': avg_profit,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'max_drawdown': max_drawdown,
            'sharpe_ratio': sharpe_ratio,
            'profit_factor': profit_factor
        }
    
    def analyze_by_strategy(self, trades: List[Dict]) -> Dict:
        """按策略分析績效"""
        strategies = {}
        
        for trade in trades:
            strategy = trade.get('strategy', 'unknown')
            
            if strategy not in strategies:
                strategies[strategy] = []
            
            strategies[strategy].append(trade)
        
        # 計算每個策略的指標
        results = {}
        for strategy, strategy_trades in strategies.items():
            results[strategy] = self.calculate_metrics(strategy_trades)
        
        return results
    
    def generate_text_report(self, period: str = "30d") -> str:
        """生成文字報告"""
        # 計算日期範圍
        end_date = datetime.now()
        
        if period.endswith('d'):
            days = int(period[:-1])
            start_date = end_date - timedelta(days=days)
        elif period.endswith('m'):
            months = int(period[:-1])
            start_date = end_date - timedelta(days=months*30)
        else:
            start_date = None
        
        # 載入交易
        trades = self.load_trades(start_date, end_date)
        
        if not trades:
            return "⚠️  期間內無交易記錄"
        
        # 計算指標
        metrics = self.calculate_metrics(trades)
        strategy_metrics = self.analyze_by_strategy(trades)
        
        # 生成報告
        report = []
        report.append("\n" + "=" * 80)
        report.append("📊 台股期貨套利系統 - 績效報告")
        report.append("=" * 80)
        report.append(f"\n報告期間: {start_date.strftime('%Y-%m-%d') if start_date else '全部'} ~ {end_date.strftime('%Y-%m-%d')}")
        report.append(f"生成時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 總體績效
        report.append("\n" + "-" * 80)
        report.append("【總體績效】")
        report.append("-" * 80)
        report.append(f"  總交易次數: {metrics['total_trades']} 筆")
        report.append(f"  總盈虧: NT${metrics['total_profit']:,.0f}")
        report.append(f"  勝率: {metrics['win_rate']:.1f}%")
        report.append(f"  獲利筆數: {metrics['winning_trades']} 筆")
        report.append(f"  虧損筆數: {metrics['losing_trades']} 筆")
        report.append(f"  平均獲利: NT${metrics['avg_profit']:,.0f}")
        report.append(f"  平均獲利單: NT${metrics['avg_win']:,.0f}")
        report.append(f"  平均虧損單: NT${metrics['avg_loss']:,.0f}")
        report.append(f"  最大回撤: NT${metrics['max_drawdown']:,.0f}")
        report.append(f"  夏普比率: {metrics['sharpe_ratio']:.2f}")
        report.append(f"  盈虧比: {metrics['profit_factor']:.2f}")
        
        # 按策略分析
        report.append("\n" + "-" * 80)
        report.append("【策略績效分析】")
        report.append("-" * 80)
        
        for strategy, strat_metrics in strategy_metrics.items():
            report.append(f"\n  策略: {strategy}")
            report.append(f"    交易次數: {strat_metrics['total_trades']} 筆")
            report.append(f"    總盈虧: NT${strat_metrics['total_profit']:,.0f}")
            report.append(f"    勝率: {strat_metrics['win_rate']:.1f}%")
            report.append(f"    平均獲利: NT${strat_metrics['avg_profit']:,.0f}")
        
        # 近期交易
        report.append("\n" + "-" * 80)
        report.append("【近期交易記錄】（最新 5 筆）")
        report.append("-" * 80)
        
        recent_trades = sorted(trades, key=lambda x: x['timestamp'], reverse=True)[:5]
        
        for i, trade in enumerate(recent_trades, 1):
            trade_time = datetime.fromisoformat(trade['timestamp'])
            report.append(f"\n  {i}. {trade_time.strftime('%Y-%m-%d %H:%M')}")
            report.append(f"     策略: {trade['strategy']}")
            report.append(f"     數量: {trade['quantity']} 口")
            report.append(f"     預期獲利: NT${trade.get('expected_profit', 0):,.0f}")
            report.append(f"     風險評分: {trade.get('risk_score', 0)}/100")
            report.append(f"     狀態: {trade.get('status', 'UNKNOWN')}")
        
        report.append("\n" + "=" * 80)
        
        return "\n".join(report)
    
    def export_to_csv(self, filename: str = None):
        """導出為 CSV"""
        if not filename:
            filename = f"data/report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        trades = self.load_trades()
        
        if not trades:
            logger.warning("⚠️  無交易記錄可導出")
            return
        
        # 轉換為 DataFrame
        df = pd.DataFrame(trades)
        
        # 儲存
        df.to_csv(filename, index=False, encoding='utf-8-sig')
        logger.info(f"💾 報告已導出至 {filename}")
    
    def generate_html_report(self, period: str = "30d") -> str:
        """生成 HTML 報告（簡化版）"""
        text_report = self.generate_text_report(period)
        
        html = f"""
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>台股期貨套利績效報告</title>
    <style>
        body {{
            font-family: 'Microsoft JhengHei', Arial, sans-serif;
            max-width: 1200px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        pre {{
            background: #2c3e50;
            color: #ecf0f1;
            padding: 20px;
            border-radius: 5px;
            overflow-x: auto;
            line-height: 1.6;
        }}
        .timestamp {{
            color: #7f8c8d;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 台股期貨套利績效報告</h1>
        <p class="timestamp">生成時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <pre>{text_report}</pre>
    </div>
</body>
</html>
"""
        
        filename = f"data/report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html)
        
        logger.info(f"💾 HTML 報告已生成: {filename}")
        return filename


def main():
    """主程式"""
    parser = argparse.ArgumentParser(description='台股期貨績效報告系統')
    parser.add_argument(
        '--period',
        default='30d',
        help='報告期間 (例如: 7d, 30d, 3m)'
    )
    parser.add_argument(
        '--export',
        choices=['text', 'csv', 'html', 'pdf'],
        default='text',
        help='匯出格式'
    )
    
    args = parser.parse_args()
    
    reporter = PerformanceReporter()
    
    if args.export == 'text':
        report = reporter.generate_text_report(args.period)
        print(report)
    
    elif args.export == 'csv':
        reporter.export_to_csv()
    
    elif args.export == 'html':
        filename = reporter.generate_html_report(args.period)
        print(f"\n✅ HTML 報告已生成: {filename}")
    
    elif args.export == 'pdf':
        print("⚠️  PDF 匯出功能待實現")
        print("提示: 可先生成 HTML 後使用瀏覽器列印為 PDF")


if __name__ == "__main__":
    main()
