#!/usr/bin/env python3
"""
完整使用範例
展示系統的完整工作流程
"""

import sys
import os
import time
import json
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.shioaji_client import ShioajiClient
from lib.spread_calculator import SpreadCalculator
from lib.risk_manager import RiskManager
from lib.telegram_notifier import TelegramNotifier


def example_1_basic_scan():
    """範例 1: 基本掃描功能"""
    print("\n" + "=" * 80)
    print("範例 1: 基本套利掃描")
    print("=" * 80)
    
    # 載入配置
    with open('config/settings.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    # 創建客戶端
    client = ShioajiClient()
    calculator = SpreadCalculator()
    
    print("\n步驟 1: 登入 API...")
    if not client.login():
        print("❌ 無法登入")
        return
    
    try:
        print("\n步驟 2: 獲取市場數據...")
        txf_price = client.get_futures_price("TXF")
        spot_index = client.get_spot_index()
        
        if not txf_price or not spot_index:
            print("❌ 無法獲取市場數據")
            return
        
        print(f"  台指期貨: {txf_price:.1f}")
        print(f"  現貨指數: {spot_index:.1f}")
        print(f"  價差: {txf_price - spot_index:.1f} 點")
        
        print("\n步驟 3: 計算套利機會...")
        market_data = {
            'futures_price': txf_price,
            'spot_index': spot_index,
            'days_to_expiry': 7
        }
        
        opportunity = calculator.generate_opportunity(
            strategy='basis',
            market_data=market_data,
            config=config['strategies']['basis_arbitrage']
        )
        
        if opportunity:
            print("✅ 發現套利機會！")
            print(f"  ID: {opportunity.id}")
            print(f"  價差: {opportunity.spread:.1f} 點")
            print(f"  預期獲利: NT${opportunity.expected_profit:.0f} / 口")
            print(f"  風險評分: {opportunity.risk_score}/100")
        else:
            print("⏭️  目前沒有符合條件的套利機會")
    
    finally:
        client.logout()
        print("\n✅ 範例完成")


def example_2_risk_management():
    """範例 2: 風險管理檢查"""
    print("\n" + "=" * 80)
    print("範例 2: 風險管理系統")
    print("=" * 80)
    
    with open('config/settings.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    risk_manager = RiskManager(config)
    
    print("\n步驟 1: 檢查是否允許交易...")
    allowed, reason = risk_manager.is_trading_allowed()
    print(f"  結果: {'✅ 允許' if allowed else '🚫 不允許'}")
    print(f"  原因: {reason}")
    
    print("\n步驟 2: 模擬帳戶資訊...")
    mock_account = {
        'available_balance': 1000000,
        'margin_used': 200000,
        'total_equity': 1200000
    }
    
    print(f"  可用餘額: NT${mock_account['available_balance']:,.0f}")
    print(f"  已用保證金: NT${mock_account['margin_used']:,.0f}")
    print(f"  總權益: NT${mock_account['total_equity']:,.0f}")
    
    print("\n步驟 3: 檢查開倉條件...")
    can_trade, reason = risk_manager.can_open_position(3, mock_account)
    print(f"  可否開倉 3 口: {'✅' if can_trade else '❌'}")
    print(f"  原因: {reason}")
    
    print("\n步驟 4: 計算建議倉位...")
    position_size = risk_manager.calculate_position_size(
        mock_account['total_equity']
    )
    print(f"  建議倉位: {position_size} 口")
    
    print("\n步驟 5: 風險報告...")
    report = risk_manager.get_risk_report()
    print(f"  當前持倉: {report['current_positions']}/{report['max_positions']}")
    print(f"  當日盈虧: NT${report['daily_pnl']:,.0f}")
    print(f"  剩餘額度: NT${report['remaining_capacity']:,.0f}")
    
    print("\n✅ 範例完成")


def example_3_telegram_notification():
    """範例 3: Telegram 通知"""
    print("\n" + "=" * 80)
    print("範例 3: Telegram 通知系統")
    print("=" * 80)
    
    with open('config/settings.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    notifier = TelegramNotifier(config.get('notifications', {}))
    
    if not notifier.enabled:
        print("\n⚠️  Telegram 通知未啟用")
        print("提示: 在 config/settings.json 中設定 telegram_enabled: true")
        return
    
    print("\n步驟 1: 測試基本通知...")
    notifier.send_custom_message(
        "測試通知",
        "這是一則測試訊息，如果收到表示 Telegram 通知設定成功！"
    )
    
    print("\n步驟 2: 模擬套利機會通知...")
    mock_opportunity = {
        'id': 'BASIS_EXAMPLE_001',
        'strategy': 'basis',
        'spread': 165.0,
        'expected_profit': 4100,
        'risk_score': 85,
        'notes': '價差過大，建議進場'
    }
    notifier.notify_opportunity(mock_opportunity)
    
    print("\n步驟 3: 模擬交易執行通知...")
    mock_trade = {
        'opportunity_id': 'BASIS_EXAMPLE_001',
        'strategy': 'basis',
        'quantity': 3,
        'expected_profit': 12300
    }
    notifier.notify_trade_executed(mock_trade)
    
    print("\n✅ 範例完成")
    print("請檢查您的 Telegram 是否收到通知")


def example_4_complete_workflow():
    """範例 4: 完整工作流程"""
    print("\n" + "=" * 80)
    print("範例 4: 完整交易工作流程（模擬）")
    print("=" * 80)
    
    with open('config/settings.json', 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    client = ShioajiClient()
    calculator = SpreadCalculator()
    risk_manager = RiskManager(config)
    notifier = TelegramNotifier(config.get('notifications', {}))
    
    print("\n📍 階段 1: 掃描市場")
    print("-" * 40)
    
    if not client.login():
        print("❌ 無法登入")
        return
    
    try:
        # 獲取市場數據
        txf_price = client.get_futures_price("TXF")
        spot_index = client.get_spot_index()
        
        if not txf_price or not spot_index:
            print("❌ 無法獲取市場數據")
            return
        
        print(f"✅ 市場數據獲取成功")
        print(f"   台指期: {txf_price:.1f}")
        print(f"   現貨: {spot_index:.1f}")
        print(f"   價差: {txf_price - spot_index:.1f} 點")
        
        # 生成套利機會
        market_data = {
            'futures_price': txf_price,
            'spot_index': spot_index,
            'days_to_expiry': 7
        }
        
        opportunity = calculator.generate_opportunity(
            strategy='basis',
            market_data=market_data,
            config=config['strategies']['basis_arbitrage']
        )
        
        if not opportunity:
            print("\n⏭️  未發現符合條件的套利機會")
            return
        
        print(f"\n✅ 發現套利機會: {opportunity.id}")
        
        # 發送通知
        if notifier.enabled:
            notifier.notify_opportunity({
                'id': opportunity.id,
                'strategy': opportunity.strategy,
                'spread': opportunity.spread,
                'expected_profit': opportunity.expected_profit,
                'risk_score': opportunity.risk_score
            })
        
        print("\n📍 階段 2: 風險評估")
        print("-" * 40)
        
        # 獲取帳戶資訊
        account = client.get_account_balance()
        if not account:
            print("❌ 無法獲取帳戶資訊")
            return
        
        print(f"✅ 帳戶檢查完成")
        print(f"   可用餘額: NT${account['available_balance']:,.0f}")
        
        # 計算倉位
        quantity = risk_manager.calculate_position_size(account['total_equity'])
        print(f"   建議倉位: {quantity} 口")
        
        # 風險檢查
        can_trade, reason = risk_manager.can_open_position(quantity, account)
        print(f"   風險檢查: {'✅' if can_trade else '❌'} {reason}")
        
        if not can_trade:
            return
        
        print("\n📍 階段 3: 模擬下單")
        print("-" * 40)
        
        # 這裡是模擬，不實際下單
        print("🧪 【模擬模式】以下為模擬操作")
        
        for action in opportunity.actions:
            print(f"   {action['action'].upper()} {action['quantity'] * quantity} 口 {action['contract']}")
            time.sleep(0.5)  # 模擬延遲
        
        print("\n✅ 模擬下單完成")
        
        # 發送交易通知
        if notifier.enabled:
            notifier.notify_trade_executed({
                'opportunity_id': opportunity.id,
                'strategy': opportunity.strategy,
                'quantity': quantity,
                'expected_profit': opportunity.expected_profit * quantity
            })
        
        print("\n📍 階段 4: 持倉監控")
        print("-" * 40)
        
        print("✅ 倉位已建立")
        print(f"   預期獲利: NT${opportunity.expected_profit * quantity:,.0f}")
        print(f"   止損點: 100 點")
        print(f"   止盈點: 200 點")
        
        # 模擬一些時間
        print("\n⏳ 等待價差收斂...")
        for i in range(3):
            time.sleep(1)
            print(f"   監控中... ({i+1}/3)")
        
        print("\n📍 階段 5: 平倉出場")
        print("-" * 40)
        
        # 模擬平倉
        simulated_pnl = opportunity.expected_profit * quantity * 0.8  # 80% 預期獲利
        print(f"✅ 模擬平倉完成")
        print(f"   實際獲利: NT${simulated_pnl:,.0f}")
        
        # 更新風險管理器
        risk_manager.daily_pnl += simulated_pnl
        print(f"   當日累計: NT${risk_manager.daily_pnl:,.0f}")
        
        # 發送平倉通知
        if notifier.enabled:
            notifier.notify_position_closed(
                {'contract': 'TXF', 'holding_time': '2 小時'},
                simulated_pnl
            )
        
        print("\n🎉 完整工作流程結束")
        print("=" * 80)
    
    finally:
        client.logout()


def main():
    """主選單"""
    print("\n" + "=" * 80)
    print("🚀 台股期貨套利系統 - 使用範例")
    print("=" * 80)
    
    examples = [
        ("基本套利掃描", example_1_basic_scan),
        ("風險管理系統", example_2_risk_management),
        ("Telegram 通知", example_3_telegram_notification),
        ("完整工作流程", example_4_complete_workflow)
    ]
    
    print("\n請選擇要執行的範例：\n")
    for i, (name, _) in enumerate(examples, 1):
        print(f"  {i}. {name}")
    print(f"  0. 全部執行")
    print()
    
    try:
        choice = input("請輸入選項 (0-4): ").strip()
        
        if choice == '0':
            for name, func in examples:
                print(f"\n執行: {name}")
                func()
                input("\n按 Enter 繼續...")
        elif choice in ['1', '2', '3', '4']:
            idx = int(choice) - 1
            examples[idx][1]()
        else:
            print("❌ 無效的選項")
    
    except KeyboardInterrupt:
        print("\n\n👋 已取消")
    except Exception as e:
        print(f"\n❌ 執行錯誤: {str(e)}")


if __name__ == "__main__":
    main()
