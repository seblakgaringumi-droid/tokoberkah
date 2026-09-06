import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ShoppingCart, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleBackToKasir = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Reset transient query params or navigate if needed
    try {
      window.location.hash = '';
    } catch {
      // ignore
    }
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Terjadi kesalahan tidak terduga pada sistem tampilan.';

      return (
        <div className="min-h-screen w-full bg-[#f4f6f4] flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 sm:p-8 border border-gray-200/80 text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200/60 shadow-xs mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-2">
              {this.props.fallbackTitle || 'Terjadi Kendala pada Aplikasi'}
            </h2>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              Aplikasi mendeteksi adanya data transaksi yang perlu disinkronkan kembali. 
              Data Anda aman dan tidak hilang. Silakan tekan tombol di bawah untuk melanjutkan.
            </p>

            {/* Error Message Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-left mb-6 overflow-hidden">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Pesan Kesalahan:
              </span>
              <p className="text-xs font-mono text-rose-700 break-words line-clamp-3">
                {errorMessage}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <button
                type="button"
                onClick={this.handleBackToKasir}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-bold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Kembali ke Kasir</span>
              </button>

              <button
                type="button"
                onClick={this.handleRefresh}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
                <span>Refresh Halaman</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
