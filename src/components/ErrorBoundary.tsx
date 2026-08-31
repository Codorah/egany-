import React from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

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
        <ErrorState
          fullScreen
          title="Une erreur est survenue"
          description="eganyé a rencontré un problème inattendu. Rechargez l'application pour continuer."
          onRetry={() => window.location.reload()}
          retryLabel="Recharger l'application"
        />
      );
    }
    return this.props.children;
  }
}
