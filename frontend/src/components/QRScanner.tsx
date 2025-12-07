'use client';

import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScanSuccess: (code: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'camera'>('file');
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // カメラストップ処理
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      cancelAnimationFrame(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 画像からQR読み取り
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setMessage(null);

    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        if (!event.target?.result) {
          setMessage('画像の読み込みに失敗しました。');
          setScanning(false);
          return;
        }

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              setMessage('画像の処理に失敗しました。');
              setScanning(false);
              return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
              setMessage('QRコードを読み取りました！');
              setTimeout(() => {
                onScanSuccess(code.data);
              }, 500);
            } else {
              setMessage('QRコードが見つかりませんでした。別の画像を試してください。');
            }
          } catch (error) {
            console.error('QR解析エラー:', error);
            setMessage('QRコードの解析に失敗しました。');
          } finally {
            setScanning(false);
          }
        };

        img.onerror = () => {
          setMessage('画像の読み込みに失敗しました。');
          setScanning(false);
        };

        img.src = event.target.result as string;
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('ファイル読み込みエラー:', error);
      setMessage('ファイルの読み込みに失敗しました。');
      setScanning(false);
    }

    // input をリセット
    e.target.value = '';
  };

  // カメラ起動
  const startCamera = async () => {
    setMessage(null);
    setScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          setScanning(false);
          startScanning();
        };
      }
    } catch (error) {
      console.error('カメラ起動エラー:', error);
      setMessage('カメラの起動に失敗しました。権限を許可してください。');
      setScanning(false);
    }
  };

  // カメラからのスキャン処理
  const startScanning = () => {
    const scan = () => {
      if (!videoRef.current || !canvasRef.current || !cameraActive) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanIntervalRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        setMessage('QRコードを読み取りました！');
        stopCamera();
        setTimeout(() => {
          onScanSuccess(code.data);
        }, 500);
      } else {
        scanIntervalRef.current = requestAnimationFrame(scan);
      }
    };

    scan();
  };

  // タブ切り替え時にカメラを停止
  useEffect(() => {
    if (activeTab === 'file') {
      stopCamera();
    }
  }, [activeTab]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">QRコード読み取り</h3>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-500 hover:text-slate-700 text-xl"
          >
            ✕
          </button>
        </div>

        {/* タブ */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'file'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            画像から読み取る
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'camera'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            カメラで読み取る
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="min-h-[300px] flex flex-col items-center justify-center">
          {activeTab === 'file' && (
            <div className="w-full space-y-4">
              <p className="text-sm text-slate-600 text-center">
                QRコード画像を選択してください。
                <br />
                スマホでは「写真を撮る」または「フォトライブラリ」から選択できます。
              </p>
              <label className="block">
                <div className="w-full py-12 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 transition cursor-pointer text-center">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="text-sm font-semibold text-slate-700">
                    {scanning ? '読み取り中...' : '画像を選択 / 撮影'}
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={scanning}
                />
              </label>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="w-full space-y-4">
              {!cameraActive ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-slate-600">
                    カメラを起動してQRコードをスキャンします。
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={scanning}
                    className="px-6 py-3 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {scanning ? 'カメラ起動中...' : 'カメラを起動'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      className="w-full h-auto"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <p className="text-sm text-slate-600 text-center">
                    QRコードをカメラに映してください
                  </p>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-full px-4 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                  >
                    カメラを停止
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* メッセージ表示 */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('成功') || message.includes('読み取りました')
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {message}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-full px-4 py-2 rounded-md border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
