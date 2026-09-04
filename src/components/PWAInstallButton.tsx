import React, { useState, useEffect, useCallback } from 'react';
import { Download, MonitorCheck, Share, PlusSquare, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (desktop PWA / home screen app)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: window-controls-overlay)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');

      setIsInstalled(Boolean(isStandaloneMode));
    };

    checkStandalone();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    };
    mediaQuery.addEventListener?.('change', handleMediaChange);

    // Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for browser install prompt (Chrome, Edge, Brave, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const installPWA = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          return true;
        } else {
          return false;
        }
      } catch (err) {
        console.error('[PWA] Error during install prompt:', err);
        return false;
      }
    } else if (isIOS) {
      setShowIOSModal(true);
      return false;
    }
    return false;
  }, [deferredPrompt, isIOS]);

  return {
    isInstalled,
    canInstall: !isInstalled && (deferredPrompt !== null || isIOS),
    hasPrompt: deferredPrompt !== null,
    isIOS,
    showIOSModal,
    setShowIOSModal,
    installPWA,
  };
}

interface PWAInstallButtonProps {
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const {
    isInstalled,
    hasPrompt,
    isIOS,
    showIOSModal,
    setShowIOSModal,
    installPWA,
  } = usePWAInstall();

  // If in Standalone Mode (Desktop App / Mobile App installed)
  if (isInstalled) {
    return (
      <div
        id="pwa-standalone-badge"
        className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-100/70 border border-emerald-300/80 text-[#15803D] text-[11px] font-semibold tracking-tight shadow-2xs select-none ${className}`}
        title="Aplikasi sedang berjalan dalam mode PWA Standalone (Desktop/Mobile)"
      >
        <MonitorCheck className="w-3.5 h-3.5 text-[#15803D]" />
        <span>Mode Aplikasi Desktop</span>
      </div>
    );
  }

  // If can install or prompt is available
  return (
    <>
      <button
        id="btn-install-pwa"
        type="button"
        onClick={() => {
          if (hasPrompt) {
            installPWA();
          } else if (isIOS) {
            setShowIOSModal(true);
          } else {
            installPWA();
          }
        }}
        className={`relative group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-[#15803D] hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer select-none ${className}`}
        title="Install Toko Berkah POS sebagai aplikasi desktop / smartphone Anda"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
        </span>
        <Download className="w-3.5 h-3.5" />
        <span className="whitespace-nowrap">Install Aplikasi</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div 
          id="pwa-ios-modal"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIOSModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-700 flex items-center justify-center text-white font-bold text-xl shadow-xs">
                TB
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Install Toko Berkah POS</h3>
                <p className="text-xs text-gray-500">Panduan instalasi di iOS / Safari</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-200/70">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                  1
                </span>
                <p>
                  Ketuk tombol <strong>Share / Bagikan</strong> (<Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-600" />) di bilah bawah browser Safari.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                  2
                </span>
                <p>
                  Gulir ke bawah dan pilih <strong>"Add to Home Screen"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-gray-700" /> Tambah ke Layar Utama).
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                  3
                </span>
                <p>
                  Ketuk <strong>Add / Tambah</strong> di pojok kanan atas untuk menyelesaikan instalasi.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-4 w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Mengerti & Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
