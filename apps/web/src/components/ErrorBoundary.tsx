import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Filter out known non-critical errors from third-party scripts
    const isKnownNonCriticalError = 
      error.message?.includes('insertBefore') ||
      error.message?.includes('osano') ||
      error.name === 'NotFoundError';

    if (isKnownNonCriticalError) {
      // Silently handle these errors - they don't break the app functionality
      console.warn('Non-critical DOM error caught and handled:', error.message);
      this.setState({ hasError: false, error: null });
      return;
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    // BASE_URL plutôt que « / » : la racine du domaine sert Odoo, pas la SPA.
    window.location.href = import.meta.env.BASE_URL || '/';
  };

  public render() {
    if (this.state.hasError) {
      // Don't show error UI for known non-critical errors
      if (
        this.state.error?.message?.includes('insertBefore') ||
        this.state.error?.message?.includes('osano') ||
        this.state.error?.name === 'NotFoundError'
      ) {
        // Return children normally - the error is non-critical
        return this.props.children;
      }

      // Show error UI for critical errors
      return (
        <Result
          status="error"
          title="Une erreur est survenue"
          subTitle="Désolé, quelque chose s'est mal passé. Veuillez réessayer."
          extra={[
            <Button type="primary" key="home" icon={<HomeOutlined />} onClick={this.handleReset}>
              Retour à l'accueil
            </Button>,
            <Button key="reload" onClick={() => window.location.reload()}>
              Recharger la page
            </Button>,
          ]}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

