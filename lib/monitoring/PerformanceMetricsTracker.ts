/**
 * Stub PerformanceMetricsTracker - No-op implementation
 * Original monitoring system was removed during simplification
 */
export class PerformanceMetricsTracker {
  trackProcessingStart(_noteId: string): void {}
  trackProcessingEnd(_noteId: string, _success: boolean): void {}
  trackTranscriptionDuration(_noteId: string, _durationMs: number): void {}
  trackAnalysisDuration(_noteId: string, _durationMs: number): void {}
  getMetrics(): Record<string, unknown> { return {} }
  reset(): void {}
}
