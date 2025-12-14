/**
 * Stub PerformanceMetricsTracker - No-op implementation
 * Original monitoring system was removed during simplification
 */
export class PerformanceMetricsTracker {
  // Legacy methods
  trackProcessingStart(_noteId: string): void {}
  trackProcessingEnd(_noteId: string, _success: boolean): void {}
  trackTranscriptionDuration(_noteId: string, _durationMs: number): void {}
  trackAnalysisDuration(_noteId: string, _durationMs: number): void {}
  getMetrics(): Record<string, unknown> { return {} }
  reset(): void {}

  // Methods used by ProcessingService
  startTracking(_noteId: string, _userId: string): Record<string, unknown> { return {} }
  completeTracking(_noteId: string, _success: boolean, _errorCategory?: string): void {}
  updateStageMetrics(_noteId: string, _stage: string, _metrics?: Record<string, unknown>): void {}
  shutdown(): void {}
}
