#!/usr/bin/env python3
"""
策略回測系統
使用歷史數據測試套利策略
"""

import sys
import os
import json
import argparse
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.spread_calculator import SpreadCalculator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class StrategyBacktester:
    """策略回測器"""
    
    def __init__(self, initial_capital: float = 500000):
        """
        初始化回測器
        
        Args:
            initial_capital: 初始資金
        """
        self.initial_capital = initial_capital
        self.calculator = SpreadCalculator()
        
        # 回測結果
        self.trades = []
        self.equity_curve = []
        self.positions = []
        
    def load_historical_data(self, filepath: str = None) -> pd.DataFrame:
        """
        載入歷史數據
        
        如果沒有真實數據，生成模擬數據
        """
        if filepath and os.path.exists(filepath):
            df = pd.read_csv(filepath, parse_dates=['timestamp'])
            return df
        
        # 生成模擬數據
        logger.info("⚠️  未提供歷史數據，生成模擬數據進行測試...")
        
        dates = pd.date_range(
            start=datetime.now() - timedelta(days=365),
            end=datetime.now(),
            freq='1H'
        )
        
        # 模擬台指期和現貨指數
        np.random.seed(42)
        
        base_index = 21000
        returns = np.random.normal(0, 0.01, len(dates))
        spot_index = base_index * (1 + returns).cumprod()
        
        # 期貨有基差
        basis = np.random.normal(100, 50, len(dates))  # 基差波動
        futures_price = spot_index + basis
        
        df = pd.DataFrame({
            'timestamp': dates,
            'spot_index': spot_index,
            'futures_price': futures_price,
            'spread': basis
        })
        
        return df
    
    def backtest_basis_arbitrage(
        self,
        data: pd.DataFrame,
        min_spread: float = 150,
        exit_spread: float = 30,
        max_holding_days: int = 14
    ) -> Dict:
        """
        回測期現價差套利策略
        
        Args:
            data: 歷史數據
            min_spread: 進場門檻
            exit_spread: 出場目標
            max_holding_days: 最大持有天數
        
        Returns:
            回測結果
        """
        logger.info("🔍 開始回測期現價差套利策略...")
        
        capital = self.initial_capital
        equity_curve = [capital]
        trades = []
        current_position = None
        
        for i in range(len(data)):
            row = data.iloc[i]
            
            # 如果有持倉，檢查出場條件
            if current_position:
                days_held = (row['timestamp'] - current_position['entry_time']).days
                current_spread = row['spread']
                
                # 出場條件
                should_exit = (
                    abs(current_spread) < exit_spread or  # 價差收斂
                    days_held >= max_holding_days  # 持有太久
                )
                
                if should_exit:
                    # 計算盈虧
                    spread_change = current_position['entry_spread'] - current_spread
                    profit = spread_change * 200  # 每點 NT$200
                    
                    # 扣除交易成本
                    trading_cost = 60 * 2 + row['futures_price'] * 200 * 0.00002
                    net_profit = profit - trading_cost
                    
                    capital += net_profit
                    
                    trades.append({
                        'entry_time': current_position['entry_time'],
                        'exit_time': row['timestamp'],
                        'entry_spread': current_position['entry_spread'],
                        'exit_spread': current_spread,
                        'holding_days': days_held,
                        'profit': net_profit,
                        'reason': 'spread_converged' if abs(current_spread) < exit_spread else 'max_holding'
                    })
                    
                    current_position = None
            
            # 如果無持倉，檢查進場條件
            else:
                if abs(row['spread']) > min_spread:
                    # 開倉
                    current_position = {
                        'entry_time': row['timestamp'],
                        'entry_spread': row['spread'],
                        'entry_futures': row['futures_price'],
                        'entry_spot': row['spot_index']
                    }
            
            equity_curve.append(capital)
        
        # 計算績效指標
        results = self._calculate_backtest_metrics(trades, equity_curve)
        results['trades'] = trades
        results['equity_curve'] = equity_curve
        
        return results
    
    def _calculate_backtest_metrics(self, trades: List[Dict], equity_curve: List[float]) -> Dict:
        """計算回測指標"""
        if not trades:
            return {
                'total_trades': 0,
                'total_profit': 0,
                'win_rate': 0,
                'sharpe_ratio': 0,
                'max_drawdown': 0
            }
        
        # 基本統計
        total_trades = len(trades)
        profits = [t['profit'] for t in trades]
        total_profit = sum(profits)
        
        winning_trades = [p for p in profits if p > 0]
        win_rate = len(winning_trades) / total_trades * 100
        
        avg_profit = np.mean(profits)
        avg_win = np.mean(winning_trades) if winning_trades else 0
        
        losing_trades = [p for p in profits if p < 0]
        avg_loss = np.mean(losing_trades) if losing_trades else 0
        
        # 最大回撤
        equity = np.array(equity_curve)
        running_max = np.maximum.accumulate(equity)
        drawdown = (equity - running_max) / running_max * 100
        max_drawdown = abs(np.min(drawdown))
        
        # 夏普比率
        returns = np.diff(equity) / equity[:-1]
        sharpe_ratio = (np.mean(returns) / np.std(returns)) * np.sqrt(252) if len(returns) > 1 else 0
        
        # 平均持有天數
        avg_holding_days = np.mean([t['holding_days'] for t in trades])
        
        return {
            'total_trades': total_trades,
            'total_profit': total_profit,
            'final_capital': equity_curve[-1],
            'total_return_percent': (equity_curve[-1] - equity_curve[0]) / equity_curve[0] * 100,
            'win_rate': win_rate,
            'avg_profit': avg_profit,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': abs(avg_win / avg_loss) if avg_loss != 0 else 0,
            'max_drawdown_percent': max_drawdown,
            'sharpe_ratio': sharpe_ratio,
            'avg_holding_days': avg_holding_days
        }
    
    def print_results(self, results: Dict):
        """打印回測結果"""
        print("\n" + "=" * 80)
        print("📊 回測結果報告")
        print("=" * 80)
        
        print(f"\n【基本資訊】")
        print(f"  初始資金: NT${self.initial_capital:,.0f}")
        print(f"  最終資金: NT${results['final_capital']:,.0f}")
        print(f"  總獲利: NT${results['total_profit']:,.0f}")
        print(f"  報酬率: {results['total_return_percent']:.2f}%")
        
        print(f"\n【交易統計】")
        print(f"  總交易次數: {results['total_trades']} 筆")
        print(f"  勝率: {results['win_rate']:.1f}%")
        print(f"  平均獲利: NT${results['avg_profit']:,.0f}")
        print(f"  平均獲利單: NT${results['avg_win']:,.0f}")
        print(f"  平均虧損單: NT${results['avg_loss']:,.0f}")
        print(f"  盈虧比: {results['profit_factor']:.2f}")
        print(f"  平均持有天數: {results['avg_holding_days']:.1f} 天")
        
        print(f"\n【風險指標】")
        print(f"  最大回撤: {results['max_drawdown_percent']:.2f}%")
        print(f"  夏普比率: {results['sharpe_ratio']:.2f}")
        
        print("\n" + "=" * 80)
        
        # 交易明細（前 10 筆）
        if 'trades' in results and results['trades']:
            print("\n【交易明細】（前 10 筆）")
            print("-" * 80)
            
            for i, trade in enumerate(results['trades'][:10], 1):
                entry_time = trade['entry_time'].strftime('%Y-%m-%d')
                exit_time = trade['exit_time'].strftime('%Y-%m-%d')
                
                print(f"\n  交易 #{i}")
                print(f"    進場: {entry_time}, 價差 {trade['entry_spread']:.1f}")
                print(f"    出場: {exit_time}, 價差 {trade['exit_spread']:.1f}")
                print(f"    持有: {trade['holding_days']} 天")
                print(f"    獲利: NT${trade['profit']:,.0f}")
                print(f"    原因: {trade['reason']}")
    
    def optimize_parameters(
        self,
        data: pd.DataFrame,
        min_spread_range: List[float] = [100, 150, 200],
        exit_spread_range: List[float] = [20, 30, 40]
    ) -> Dict:
        """
        參數優化
        
        測試不同參數組合，找出最佳設定
        """
        logger.info("🔧 開始參數優化...")
        
        best_sharpe = -999
        best_params = None
        best_results = None
        
        all_results = []
        
        for min_spread in min_spread_range:
            for exit_spread in exit_spread_range:
                results = self.backtest_basis_arbitrage(
                    data,
                    min_spread=min_spread,
                    exit_spread=exit_spread
                )
                
                results['params'] = {
                    'min_spread': min_spread,
                    'exit_spread': exit_spread
                }
                
                all_results.append(results)
                
                if results['sharpe_ratio'] > best_sharpe:
                    best_sharpe = results['sharpe_ratio']
                    best_params = results['params']
                    best_results = results
                
                logger.info(f"  測試 min_spread={min_spread}, exit_spread={exit_spread} "
                           f"→ 夏普比率: {results['sharpe_ratio']:.2f}")
        
        print("\n" + "=" * 80)
        print("🏆 最佳參數組合")
        print("=" * 80)
        print(f"  進場門檻: {best_params['min_spread']} 點")
        print(f"  出場目標: {best_params['exit_spread']} 點")
        print(f"  夏普比率: {best_sharpe:.2f}")
        print(f"  總獲利: NT${best_results['total_profit']:,.0f}")
        print(f"  勝率: {best_results['win_rate']:.1f}%")
        
        return {
            'best_params': best_params,
            'best_results': best_results,
            'all_results': all_results
        }


def main():
    """主程式"""
    parser = argparse.ArgumentParser(description='台股期貨策略回測系統')
    parser.add_argument(
        '--data',
        help='歷史數據檔案路徑 (CSV)'
    )
    parser.add_argument(
        '--capital',
        type=float,
        default=500000,
        help='初始資金'
    )
    parser.add_argument(
        '--min-spread',
        type=float,
        default=150,
        help='進場價差門檻'
    )
    parser.add_argument(
        '--exit-spread',
        type=float,
        default=30,
        help='出場價差目標'
    )
    parser.add_argument(
        '--optimize',
        action='store_true',
        help='執行參數優化'
    )
    
    args = parser.parse_args()
    
    # 創建回測器
    backtester = StrategyBacktester(initial_capital=args.capital)
    
    # 載入數據
    data = backtester.load_historical_data(args.data)
    logger.info(f"✅ 載入 {len(data)} 筆歷史數據")
    
    if args.optimize:
        # 參數優化
        optimization_results = backtester.optimize_parameters(data)
    else:
        # 單次回測
        results = backtester.backtest_basis_arbitrage(
            data,
            min_spread=args.min_spread,
            exit_spread=args.exit_spread
        )
        
        backtester.print_results(results)


if __name__ == "__main__":
    main()
