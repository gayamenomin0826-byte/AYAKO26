import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-brand-card border border-brand-accent/20 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-display font-extrabold text-brand-text">
                Алдаа гарлаа
              </h2>
              <p className="text-xs text-brand-text-dark leading-relaxed">
                Системийн санах ойд түр алдаа гарлаа. Хуудсыг дахин ачаалснаар хэвийн ажиллах болно.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] text-red-300 font-mono text-left max-h-28 overflow-y-auto break-all">
                {this.state.error.message || 'Unknown runtime error'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-xs font-display font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-brand-accent/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Дахин ачааллах</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3 px-4 bg-brand-bg hover:bg-brand-card text-brand-text border border-brand-accent/20 text-xs font-display font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4 text-brand-accent" />
                <span>Нүүр хуудас</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
