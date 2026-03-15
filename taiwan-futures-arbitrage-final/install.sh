#!/bin/bash

# Taiwan Futures Arbitrage - 安裝腳本
# 自動設置環境和依賴

set -e

echo "════════════════════════════════════════════════════════════"
echo "Taiwan Futures Arbitrage - 安裝程序"
echo "════════════════════════════════════════════════════════════"
echo ""

# 檢查 Python 版本
echo "🔍 檢查 Python 版本..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "   已安裝: Python $python_version"

required_version="3.9"
if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ 需要 Python 3.9 或更高版本"
    exit 1
fi
echo "✅ Python 版本符合要求"
echo ""

# 創建虛擬環境（可選）
read -p "是否創建虛擬環境？(y/n): " create_venv
if [ "$create_venv" = "y" ]; then
    echo "📦 創建虛擬環境..."
    python3 -m venv venv
    source venv/bin/activate
    echo "✅ 虛擬環境已創建並啟用"
    echo ""
fi

# 安裝依賴
echo "📦 安裝 Python 依賴..."
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ 依賴安裝成功"
else
    echo "❌ 依賴安裝失敗"
    exit 1
fi
echo ""

# 創建配置文件
if [ ! -f "config/settings.json" ]; then
    echo "⚙️  創建配置文件..."
    cp config/settings.example.json config/settings.json
    echo "✅ 配置文件已創建: config/settings.json"
    echo "   請編輯此文件並填入您的 API 憑證"
else
    echo "ℹ️  配置文件已存在，跳過創建"
fi
echo ""

# 創建必要目錄
echo "📁 創建數據目錄..."
mkdir -p data/logs
mkdir -p data/backups
echo "✅ 目錄創建完成"
echo ""

# 測試安裝
echo "🧪 測試安裝..."
python3 -c "import shioaji; import pandas; import numpy; print('✅ 核心模組測試通過')"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "🎉 安裝完成！"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "下一步："
echo "1. 編輯 config/settings.json 填入您的 API 憑證"
echo "2. 執行初始化: python3 scripts/setup.py"
echo "3. 測試連線: python3 scripts/scanner.py --format text"
echo ""
echo "詳細文檔請參考:"
echo "- QUICKSTART.md (快速開始)"
echo "- DEPLOYMENT.md (完整部署指南)"
echo "- README.md (使用手冊)"
echo ""
echo "祝您交易順利！🚀"
