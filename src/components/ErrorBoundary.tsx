import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center gap-4">
          <img src="/logo-emblem.png" alt="eganyé" className="w-16 h-16 rounded-2xl shadow-xl" />
          <h1 className="text-xl font-serif font-black">Une erreur est survenue</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            eganyé a rencontré un problème inattendu. Rechargez l'application pour continuer.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="gradient-sunset text-white font-bold rounded-2xl h-12 px-6 cursor-pointer"
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
