import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error?.message || 'Something went wrong while loading this view.';
    try {
      const parsed = JSON.parse(readable);
      if (parsed?.error) {
        readable = parsed.error.includes('permission-denied')
          ? 'Access permission error while syncing with Cloud Firestore. Please sign in or contact ZARIFLY support.'
          : parsed.error;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error) {
    console.error('ZARIFLY ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF] px-4 py-12">
          <div className="max-w-md w-full bg-white rounded-3xl border border-[#EFE7F8] p-8 text-center shadow-lg">
            <h2 className="font-serif text-2xl text-[#181326]">ZARIFLY Boutique</h2>
            <p className="mt-3 text-sm text-[#5B526E] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="mt-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-semibold uppercase tracking-wider cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
