import { Component, type ReactNode } from "react";

/** If anything ever breaks, show a way back instead of a black screen. Your data is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-bg px-8 text-center">
        <div className="text-[22px] font-semibold tracking-[-0.02em]">Something slipped.</div>
        <p className="mt-2 max-w-[300px] text-[15px] text-mute">Your plan and history are safe. Tap below to pick up where you left off.</p>
        <button
          type="button"
          onClick={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
          className="mt-6 h-12 rounded-2xl bg-ember px-6 font-semibold text-black"
        >
          Back to it
        </button>
        <p className="mt-6 max-w-[320px] text-[11px] break-words text-faint">{this.state.error.message}</p>
      </div>
    );
  }
}
