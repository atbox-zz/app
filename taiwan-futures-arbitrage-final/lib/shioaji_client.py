"""
Shioaji API 客戶端封裝
提供統一的介面與永豐 API 互動
"""

import shioaji as sj
from shioaji import constant
from typing import Dict, List, Optional, Callable
import logging
import os
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class ShioajiClient:
    """永豐 Shioaji API 客戶端"""
    
    def __init__(self, config_path: str = "config/settings.json"):
        """初始化客戶端"""
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        self.config = config['shioaji']
        self.api = None
        self.contracts_loaded = False
        
    def login(self) -> bool:
        """登入 API"""
        try:
            self.api = sj.Shioaji(simulation=self.config['simulation'])
            
            accounts = self.api.login(
                api_key=self.config['api_key'],
                secret_key=self.config['secret_key']
            )
            
            logger.info(f"✅ 成功登入 Shioaji API (模擬: {self.config['simulation']})")
            logger.info(f"帳戶資訊: {accounts}")
            
            # 激活電子憑證（實盤交易需要）
            if not self.config['simulation'] and self.config.get('ca_path'):
                self.api.activate_ca(
                    ca_path=self.config['ca_path'],
                    ca_passwd=self.config['ca_password']
                )
                logger.info("✅ 電子憑證已激活")
            
            # 載入合約檔
            self._load_contracts()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 登入失敗: {str(e)}")
            return False
    
    def _load_contracts(self):
        """載入合約檔"""
        try:
            # 訂閱合約更新回調
            def on_contracts_loaded(security_type):
                logger.info(f"📄 {security_type} 合約檔載入完成")
            
            self.api.set_on_tick_stk_v1_callback(on_contracts_loaded)
            self.contracts_loaded = True
            
        except Exception as e:
            logger.error(f"❌ 載入合約檔失敗: {str(e)}")
    
    def get_futures_price(self, symbol: str) -> Optional[float]:
        """獲取期貨即時價格"""
        try:
            # 取得合約
            if symbol == "TXF":
                # 近月台指期
                contract = self.api.Contracts.Futures.TXF[
                    list(self.api.Contracts.Futures.TXF)[0]
                ]
            elif symbol == "TE":
                # 電子期
                contract = self.api.Contracts.Futures.TE[
                    list(self.api.Contracts.Futures.TE)[0]
                ]
            elif symbol == "TF":
                # 金融期
                contract = self.api.Contracts.Futures.TF[
                    list(self.api.Contracts.Futures.TF)[0]
                ]
            else:
                logger.error(f"不支援的合約: {symbol}")
                return None
            
            # 訂閱即時報價
            self.api.quote.subscribe(
                contract,
                quote_type=constant.QuoteType.Tick,
                version=constant.QuoteVersion.v1
            )
            
            # 獲取快照
            snapshot = self.api.snapshots([contract])[0]
            
            return snapshot.close if snapshot else None
            
        except Exception as e:
            logger.error(f"❌ 獲取 {symbol} 價格失敗: {str(e)}")
            return None
    
    def get_spot_index(self) -> Optional[float]:
        """獲取現貨指數（加權指數）"""
        try:
            # 台股加權指數
            contract = self.api.Contracts.Indexs.TSE.TSE001
            
            self.api.quote.subscribe(
                contract,
                quote_type=constant.QuoteType.Tick
            )
            
            snapshot = self.api.snapshots([contract])[0]
            return snapshot.close if snapshot else None
            
        except Exception as e:
            logger.error(f"❌ 獲取現貨指數失敗: {str(e)}")
            return None
    
    def place_order(
        self,
        contract_symbol: str,
        action: str,  # 'Buy' or 'Sell'
        quantity: int,
        price: Optional[float] = None,
        order_type: str = "ROD"
    ) -> Optional[str]:
        """下單"""
        try:
            # 取得合約
            if contract_symbol.startswith("TXF"):
                contract = self.api.Contracts.Futures.TXF[contract_symbol]
            elif contract_symbol.startswith("TE"):
                contract = self.api.Contracts.Futures.TE[contract_symbol]
            elif contract_symbol.startswith("TF"):
                contract = self.api.Contracts.Futures.TF[contract_symbol]
            else:
                raise ValueError(f"不支援的合約: {contract_symbol}")
            
            # 建立訂單
            if price:
                # 限價單
                order = self.api.Order(
                    action=constant.Action.Buy if action == 'Buy' else constant.Action.Sell,
                    price=price,
                    quantity=quantity,
                    price_type=constant.FuturesPriceType.LMT,
                    order_type=constant.OrderType.ROD,
                    account=self.api.futopt_account
                )
            else:
                # 市價單
                order = self.api.Order(
                    action=constant.Action.Buy if action == 'Buy' else constant.Action.Sell,
                    price=0,
                    quantity=quantity,
                    price_type=constant.FuturesPriceType.MKT,
                    order_type=constant.OrderType.ROD,
                    account=self.api.futopt_account
                )
            
            # 送出訂單
            trade = self.api.place_order(contract, order)
            
            logger.info(f"✅ 訂單已送出: {action} {quantity} 口 {contract_symbol} @ {price or '市價'}")
            logger.info(f"訂單編號: {trade.order.id}")
            
            return trade.order.id
            
        except Exception as e:
            logger.error(f"❌ 下單失敗: {str(e)}")
            return None
    
    def get_positions(self) -> List[Dict]:
        """獲取當前持倉"""
        try:
            positions = self.api.list_positions(
                account=self.api.futopt_account
            )
            
            result = []
            for pos in positions:
                result.append({
                    'code': pos.code,
                    'quantity': pos.quantity,
                    'price': pos.price,
                    'current_price': pos.last_price,
                    'pnl': pos.pnl,
                    'direction': 'Long' if pos.quantity > 0 else 'Short'
                })
            
            return result
            
        except Exception as e:
            logger.error(f"❌ 獲取持倉失敗: {str(e)}")
            return []
    
    def get_account_balance(self) -> Optional[Dict]:
        """獲取帳戶餘額"""
        try:
            balance = self.api.account_balance()
            
            return {
                'available_balance': balance.acc_balance,
                'margin_used': balance.margin,
                'total_equity': balance.equity,
                'unrealized_pnl': balance.unrealized_pnl
            }
            
        except Exception as e:
            logger.error(f"❌ 獲取帳戶餘額失敗: {str(e)}")
            return None
    
    def subscribe_realtime_quote(
        self,
        symbols: List[str],
        callback: Callable
    ):
        """訂閱即時報價"""
        try:
            for symbol in symbols:
                if symbol.startswith("TXF"):
                    contract = self.api.Contracts.Futures.TXF[symbol]
                elif symbol.startswith("TE"):
                    contract = self.api.Contracts.Futures.TE[symbol]
                elif symbol.startswith("TF"):
                    contract = self.api.Contracts.Futures.TF[symbol]
                else:
                    continue
                
                self.api.quote.subscribe(
                    contract,
                    quote_type=constant.QuoteType.Tick,
                    version=constant.QuoteVersion.v1
                )
            
            # 設定回調
            @self.api.on_quote_stk_v1()
            def quote_callback(exchange, tick):
                callback(tick)
            
            logger.info(f"✅ 已訂閱即時報價: {symbols}")
            
        except Exception as e:
            logger.error(f"❌ 訂閱報價失敗: {str(e)}")
    
    def logout(self):
        """登出"""
        if self.api:
            self.api.logout()
            logger.info("✅ 已登出 Shioaji API")


# 使用範例
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    client = ShioajiClient()
    
    if client.login():
        # 獲取台指期價格
        txf_price = client.get_futures_price("TXF")
        print(f"台指期價格: {txf_price}")
        
        # 獲取現貨指數
        spot_index = client.get_spot_index()
        print(f"現貨指數: {spot_index}")
        
        # 計算價差
        if txf_price and spot_index:
            spread = txf_price - spot_index
            print(f"價差: {spread} 點")
        
        # 查看持倉
        positions = client.get_positions()
        print(f"當前持倉: {positions}")
        
        client.logout()
