#!/usr/bin/env python3
"""
初始化設定腳本
協助用戶設定 API 憑證和系統參數
"""

import json
import os
import argparse
import getpass


def setup_credentials():
    """互動式設定 API 憑證"""
    print("=" * 60)
    print("Taiwan Futures Arbitrage - 初始化設定")
    print("=" * 60)
    print()
    
    # 讀取現有配置
    config_path = "config/settings.json"
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    print("請輸入您的永豐 API 憑證：")
    print("(可在 https://www.sinotrade.com.tw/ec/20191125/Main/index.aspx 申請)")
    print()
    
    # API 憑證
    api_key = input("API Key: ").strip()
    secret_key = getpass.getpass("Secret Key: ").strip()
    
    # 交易模式
    print("\n選擇交易模式：")
    print("1. 模擬模式（推薦新手）")
    print("2. 實盤模式")
    mode = input("請選擇 (1/2): ").strip()
    
    simulation = mode == '1'
    
    # 電子憑證（實盤需要）
    ca_path = ""
    ca_password = ""
    
    if not simulation:
        print("\n⚠️  實盤模式需要電子憑證")
        ca_path = input("電子憑證路徑: ").strip()
        ca_password = getpass.getpass("憑證密碼: ").strip()
    
    # 更新配置
    config['shioaji']['api_key'] = api_key
    config['shioaji']['secret_key'] = secret_key
    config['shioaji']['simulation'] = simulation
    
    if ca_path:
        config['shioaji']['ca_path'] = ca_path
        config['shioaji']['ca_password'] = ca_password
    
    # 風險參數
    print("\n設定風險管理參數：")
    
    max_positions = input(f"最大持倉數 (預設 {config['trading']['max_positions']}): ").strip()
    if max_positions:
        config['trading']['max_positions'] = int(max_positions)
    
    daily_loss = input(f"每日虧損上限 NT$ (預設 {config['trading']['daily_loss_limit']}): ").strip()
    if daily_loss:
        config['trading']['daily_loss_limit'] = float(daily_loss)
    
    # 儲存配置
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ 設定完成！")
    print("=" * 60)
    print()
    print("下一步：")
    print("1. 測試連線: python3 scripts/scanner.py --format text")
    print("2. 掃描機會: python3 scripts/scanner.py --strategy basis")
    print("3. 啟動自動交易: python3 scripts/autotrader.py --single-scan")
    print()


def create_directories():
    """創建必要的目錄"""
    directories = [
        'data',
        'data/logs',
        'config'
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"✅ 創建目錄: {directory}")


def main():
    parser = argparse.ArgumentParser(description='初始化台股期貨套利系統')
    parser.add_argument(
        '--api-key',
        help='永豐 API Key（可選，不提供則進入互動模式）'
    )
    parser.add_argument(
        '--secret-key',
        help='永豐 Secret Key'
    )
    
    args = parser.parse_args()
    
    # 創建目錄
    create_directories()
    
    # 設定憑證
    if args.api_key and args.secret_key:
        # 命令行模式
        config_path = "config/settings.json"
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        config['shioaji']['api_key'] = args.api_key
        config['shioaji']['secret_key'] = args.secret_key
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        print("✅ API 憑證已設定")
    else:
        # 互動模式
        setup_credentials()


if __name__ == "__main__":
    main()
