# Refactored Alerting System

The Voice Memory alerting system has been refactored from a monolithic 832-line service into focused, specialized services for better maintainability and scalability.

## Architecture Overview

The new architecture consists of 7 specialized services coordinated by a main orchestrator:

### Core Services

1. **AlertLifecycleService** - Alert CRUD operations and state management
2. **AlertRuleEngine** - Rule evaluation, condition matching, and processing
3. **NotificationDispatcher** - Channel management and message delivery
4. **EscalationScheduler** - Timer management and escalation logic
5. **AlertMetricsCollector** - Metrics tracking and reporting
6. **AlertSuppressor** - Deduplication and suppression logic
7. **ChannelHealthMonitor** - Channel testing and health tracking

### Supporting Infrastructure

- **AlertingServiceOrchestrator** - Main service coordinator
- **AlertRepository** - Data persistence and retrieval
- **NotificationTemplates** - Message formatting and templates
- **AlertingConfigManager** - Configuration management
- **AlertingTypes** - Comprehensive type definitions
- **AlertingUtils** - Helper functions and utilities

## Migration Guide

### For Existing Code

The original `AlertingService` interface is maintained through a backward-compatible facade:

```typescript
// This continues to work unchanged
import { AlertingService } from '@/lib/monitoring/AlertingService'
const alerting = new AlertingService()
```

### For New Code

Use the new orchestrator directly for enhanced functionality:

```typescript
import { AlertingServiceOrchestrator } from '@/lib/monitoring/alerting'
const alerting = new AlertingServiceOrchestrator()
```

## Key Improvements

### 1. Separation of Concerns
- Each service has a single, focused responsibility
- Better testability and maintainability
- Easier to extend and modify individual components

### 2. Enhanced Functionality
- **Advanced Suppression**: Rule-based, duplicate detection, and rate limiting
- **Comprehensive Health Monitoring**: Real-time channel health checks
- **Rich Metrics**: Detailed tracking and historical data
- **Flexible Escalation**: Advanced timer management and escalation rules
- **Multiple Notification Channels**: Slack, Discord, Teams, PagerDuty, email, webhooks

### 3. Better Error Handling
- Circuit breaker patterns for external services
- Graceful degradation when channels fail
- Retry mechanisms and failure tracking

### 4. Performance Optimizations
- Efficient memory management for timers and metrics
- Optimized notification delivery
- Background cleanup processes

## Usage Examples

### Basic Alert Creation

```typescript
const alert = await alerting.createAlert(
  'database',           // type
  'critical',          // severity
  'Database Connection Lost',
  'Unable to connect to the primary database',
  { connectionId: 'primary-db', attempts: 3 },
  'db-monitor',        // source
  ['database', 'connectivity'],  // tags
  ['database-primary'] // affected resources
)
```

### Advanced Configuration

```typescript
// Add custom alert rule
alerting.addAlertRule({
  id: 'custom-performance-rule',
  name: 'High API Latency',
  description: 'API response time exceeds threshold',
  condition: 'api.responseTime > 2000',
  severity: 'high',
  enabled: true,
  cooldownMinutes: 10,
  escalationRules: [
    { level: 1, delayMinutes: 5, notificationChannels: ['slack-alerts'] },
    { level: 2, delayMinutes: 15, notificationChannels: ['slack-alerts', 'pagerduty'] }
  ],
  suppressionRules: [],
  notificationChannels: ['slack-alerts'],
  tags: ['api', 'performance']
})

// Add custom notification channel
alerting.addNotificationChannel({
  id: 'custom-slack',
  type: 'slack',
  name: 'Custom Slack Channel',
  enabled: true,
  config: {
    channel: '#alerts-custom',
    token: process.env.SLACK_BOT_TOKEN
  },
  failureCount: 0
})
```

### System Monitoring

```typescript
// Get comprehensive system status
const status = alerting.getSystemStatus()
console.log('Active alerts:', status.alerts.active)
console.log('Channel health:', status.channels.healthy, '/', status.channels.total)

// Get detailed diagnostics
const diagnostics = alerting.getDiagnostics()
console.log('Configuration valid:', diagnostics.configValidation.isValid)
console.log('Unhealthy channels:', diagnostics.channelHealth.filter(h => !h.isHealthy))

// Test entire pipeline
const testResult = await alerting.testAlertingPipeline()
console.log('Pipeline test:', testResult.success ? 'PASSED' : 'FAILED')
```

## Service Responsibilities

### AlertLifecycleService
- Create, acknowledge, resolve, suppress alerts
- Manage alert state transitions
- Track notification records
- Handle cleanup and statistics

### AlertRuleEngine
- Evaluate alert conditions against rules
- Manage rule CRUD operations
- Support complex condition expressions
- Rule validation and testing

### NotificationDispatcher
- Send notifications through multiple channels
- Manage channel configurations
- Handle delivery failures and retries
- Support rich message templates

### EscalationScheduler
- Schedule and manage escalation timers
- Execute escalation callbacks
- Track escalation history
- Handle timer cleanup and rescheduling

### AlertMetricsCollector
- Collect comprehensive metrics
- Track performance indicators
- Maintain historical data
- Generate reports and summaries

### AlertSuppressor
- Prevent alert spam through deduplication
- Apply rule-based suppression
- Implement rate limiting
- Track suppression statistics

### ChannelHealthMonitor
- Monitor notification channel health
- Perform periodic health checks
- Track channel performance metrics
- Provide health status reporting

## Configuration

The system uses centralized configuration through `AlertingConfigManager`:

```typescript
// Configure through environment variables
SLACK_BOT_TOKEN=xoxb-your-slack-token
SENDGRID_API_KEY=your-sendgrid-key
PAGERDUTY_ROUTING_KEY=your-pagerduty-key

// Or through config files
const config = {
  monitoring: {
    alerting: {
      enabled: true,
      slackChannel: '#alerts',
      webhookUrl: 'https://your-webhook-url.com'
    }
  }
}
```

## Default Alert Rules

The system includes 25+ default alert rules covering:

- **Database**: Connection issues, storage usage, query performance
- **Performance**: Response times, throughput, resource usage
- **System**: CPU, memory, disk space
- **Security**: Authentication failures, suspicious activity
- **Integration**: External API failures, circuit breaker states

## Notification Channels

Supported notification types:
- **Slack** - Rich message formatting with attachments
- **Discord** - Embed messages with colors and fields
- **Microsoft Teams** - MessageCard format
- **PagerDuty** - Incident creation and management
- **Email** - HTML and plain text formats
- **Webhooks** - Custom JSON payloads
- **Console** - Development fallback

## Error Handling and Resilience

- **Circuit Breaker**: Prevents cascade failures
- **Timeout Management**: Configurable timeouts for all operations
- **Retry Logic**: Exponential backoff for transient failures
- **Graceful Degradation**: Continues operation when components fail
- **Health Monitoring**: Automatic detection and recovery

## Testing and Validation

```typescript
// Test individual channels
const success = await alerting.testNotificationChannel('slack-alerts')

// Validate configuration
const validation = alerting.getDiagnostics().configValidation
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors)
}

// Test complete pipeline
const pipelineTest = await alerting.testAlertingPipeline()
pipelineTest.steps.forEach(step => {
  console.log(`${step.step}: ${step.success ? 'PASS' : 'FAIL'} (${step.duration}ms)`)
})
```

## Performance Considerations

- **Memory Management**: Automatic cleanup of old alerts and metrics
- **Efficient Timers**: Optimized escalation scheduling
- **Rate Limiting**: Prevents notification spam
- **Batching**: Groups similar alerts when appropriate
- **Compression**: Historical data compression for storage efficiency

## Monitoring and Observability

The system provides comprehensive observability:

- **Real-time Metrics**: Alert counts, response times, success rates
- **Historical Trends**: Performance over time
- **Health Dashboards**: Service and channel health
- **Audit Trails**: Complete alert lifecycle tracking
- **Performance Analytics**: Detailed system performance data

## Backward Compatibility

All existing code using `AlertingService` continues to work without modification. The facade provides:

- Identical interface and method signatures
- Same behavior and return types
- Enhanced functionality through additional methods
- Migration path to new services

## Future Enhancements

The modular architecture enables easy addition of:

- **Additional Notification Channels**: SMS, push notifications, etc.
- **Machine Learning**: Intelligent alert correlation and suppression
- **Advanced Analytics**: Predictive alerting and trend analysis
- **Integration APIs**: External monitoring service integration
- **Custom Rule Engines**: Domain-specific alert logic

This refactored system provides a solid foundation for enterprise-grade alerting while maintaining simplicity for basic use cases.