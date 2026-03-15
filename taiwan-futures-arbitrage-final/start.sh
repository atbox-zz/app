#!/bin/bash

# Taiwan Futures Arbitrage - 快速啟動腳本

echo "════════════════════════════════════════════════════════════"
echo "Taiwan Futures Arbitrage - 啟動選單"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "請選擇要執行的功能："
echo ""
echo "1. 掃描套利機會"
echo "2. 查看持倉監控"
echo "3. 生成績效報告"
echo "4. 啟動自動交易"
echo "5. 執行回測"
echo "6. 執行範例演示"
echo "7. 初始化設定"
echo "0. 退出"
echo ""

read -p "請輸入選項 (0-7): " choice

case $choice in
    1)
        echo ""
        echo "🔍 掃描套利機會..."
        python3 scripts/scanner.py --strategy all --format text
        ;;
    2)
        echo ""
        echo "📊 顯示監控儀表板..."
        python3 scripts/monitor.py --mode dashboard
        ;;
    3)
        echo ""
        read -p "報告期間 (預設 30d): " period
        period=${period:-30d}
        python3 scripts/report.py --period $period --export html
        ;;
    4)
        echo ""
        echo "⚠️  即將啟動自動交易"
        read -p "確認要啟動嗎？(yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "🚀 啟動自動交易引擎..."
            python3 scripts/autotrader.py --strategies basis
        else
            echo "已取消"
        fi
        ;;
    5)
        echo ""
        echo "🧪 執行回測..."
        python3 scripts/backtest.py --capital 500000
        ;;
    6)
        echo ""
        echo "📚 執行範例演示..."
        python3 scripts/examples.py
        ;;
    7)
        echo ""
        echo "⚙️  初始化設定..."
        python3 scripts/setup.py
        ;;
    0)
        echo ""
        echo "👋 再見！"
        exit 0
        ;;
    *)
        echo ""
        echo "❌ 無效的選項"
        exit 1
        ;;
esac

echo ""
echo "執行完成！"
