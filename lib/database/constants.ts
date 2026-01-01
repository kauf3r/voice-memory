/**
 * Database Constants - Centralized Table Names and Configuration
 * 
 * This file prevents table name mismatches that caused the processing pipeline failure.
 * All database operations should use these constants instead of hardcoded strings.
 */

// Database table names - these MUST match the actual Supabase schema
export const TABLES = {
  // Core tables
  NOTES: 'notes',
  USERS: 'users',
  PROJECT_KNOWLEDGE: 'project_knowledge',
  
  // Task management tables
  TASK_PINS: 'task_pins',
  TASK_STATES: 'task_states',
  
  // Processing and error tracking
  PROCESSING_ERRORS: 'processing_errors',
  RATE_LIMITS: 'rate_limits',
} as const;

// Database column names for type safety
export const COLUMNS = {
  NOTES: {
    ID: 'id',
    USER_ID: 'user_id',
    AUDIO_URL: 'audio_url',
    DURATION_SECONDS: 'duration_seconds',
    TRANSCRIPTION: 'transcription',
    ANALYSIS: 'analysis',
    RECORDED_AT: 'recorded_at',
    PROCESSED_AT: 'processed_at',
    CREATED_AT: 'created_at',
    
    // Error tracking columns
    ERROR_MESSAGE: 'error_message',
    PROCESSING_ATTEMPTS: 'processing_attempts',
    LAST_ERROR_AT: 'last_error_at',
    
    // Processing lock columns
    PROCESSING_STARTED_AT: 'processing_started_at',
  },
  
  USERS: {
    ID: 'id',
    EMAIL: 'email',
    CREATED_AT: 'created_at',
  },
  
  PROJECT_KNOWLEDGE: {
    ID: 'id',
    USER_ID: 'user_id',
    CONTENT: 'content',
    UPDATED_AT: 'updated_at',
  },
  
  TASK_PINS: {
    ID: 'id',
    USER_ID: 'user_id',
    TASK_ID: 'task_id',
    PINNED_AT: 'pinned_at',
    DISPLAY_ORDER: 'display_order',
  },
  
  TASK_STATES: {
    ID: 'id',
    USER_ID: 'user_id',
    TASK_ID: 'task_id',
    COMPLETED: 'completed',
    COMPLETED_AT: 'completed_at',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at',
  },
  
  PROCESSING_ERRORS: {
    ID: 'id',
    NOTE_ID: 'note_id',
    ERROR_MESSAGE: 'error_message',
    ERROR_TYPE: 'error_type',
    STACK_TRACE: 'stack_trace',
    PROCESSING_ATTEMPT: 'processing_attempt',
    CREATED_AT: 'created_at',
  },
} as const;

// Database function names
export const FUNCTIONS = {
  // Processing functions
  ACQUIRE_PROCESSING_LOCK: 'acquire_processing_lock',
  RELEASE_PROCESSING_LOCK: 'release_processing_lock',
  RELEASE_PROCESSING_LOCK_WITH_ERROR: 'release_processing_lock_with_error',
  CLEANUP_ABANDONED_PROCESSING_LOCKS: 'cleanup_abandoned_processing_locks',
  GET_NEXT_NOTES_FOR_PROCESSING: 'get_next_notes_for_processing',
  
  // Error tracking functions
  LOG_PROCESSING_ERROR: 'log_processing_error',
  CLEAR_PROCESSING_ERROR: 'clear_processing_error',
  
  // Statistics functions
  GET_PROCESSING_STATS: 'get_processing_stats',
} as const;

// Database configuration constants
export const DATABASE_CONFIG = {
  // Query limits
  DEFAULT_LIMIT: 100,
  MAX_LIMIT: 1000,
  SMALL_BATCH_SIZE: 10,
  LARGE_BATCH_SIZE: 50,
  
  // Timeout settings (in minutes)
  PROCESSING_LOCK_TIMEOUT: 15,
  DEFAULT_QUERY_TIMEOUT: 30,
  LONG_RUNNING_QUERY_TIMEOUT: 300,
  
  // Retry settings
  DEFAULT_RETRY_ATTEMPTS: 3,
  PROCESSING_RETRY_ATTEMPTS: 2,
  EXPONENTIAL_BACKOFF_BASE: 2,
  
  // Processing settings
  MAX_PROCESSING_ATTEMPTS: 5,
  PROCESSING_COOLDOWN_MINUTES: 60,
} as const;

// Type definitions for better TypeScript support
export type TableName = typeof TABLES[keyof typeof TABLES];
export type NotesColumn = typeof COLUMNS.NOTES[keyof typeof COLUMNS.NOTES];
export type UsersColumn = typeof COLUMNS.USERS[keyof typeof COLUMNS.USERS];
export type TaskPinsColumn = typeof COLUMNS.TASK_PINS[keyof typeof COLUMNS.TASK_PINS];
export type TaskStatesColumn = typeof COLUMNS.TASK_STATES[keyof typeof COLUMNS.TASK_STATES];
export type FunctionName = typeof FUNCTIONS[keyof typeof FUNCTIONS];

// Validation helpers
export function isValidTableName(tableName: string): tableName is TableName {
  return Object.values(TABLES).includes(tableName as TableName);
}

export function isValidFunctionName(functionName: string): functionName is FunctionName {
  return Object.values(FUNCTIONS).includes(functionName as FunctionName);
}

// Table validation - ensures all referenced tables exist
export const TABLE_VALIDATION = {
  // Core application tables that MUST exist
  REQUIRED_TABLES: [
    TABLES.NOTES,
    TABLES.USERS,
    TABLES.PROJECT_KNOWLEDGE,
    TABLES.TASK_PINS,
    TABLES.TASK_STATES,
  ],
  
  // Processing and error tracking tables
  PROCESSING_TABLES: [
    TABLES.PROCESSING_ERRORS,
    TABLES.RATE_LIMITS,
  ],
  
  // All tables that should exist in a healthy database
  ALL_TABLES: [
    TABLES.NOTES,
    TABLES.USERS,
    TABLES.PROJECT_KNOWLEDGE,
    TABLES.TASK_PINS,
    TABLES.TASK_STATES,
    TABLES.PROCESSING_ERRORS,
    TABLES.RATE_LIMITS,
  ],
} as const;

// Pre-defined SELECT column lists for common queries (avoids SELECT *)
export const SELECT_COLUMNS = {
  // Full note record
  NOTES_FULL: 'id, user_id, audio_url, duration_seconds, transcription, analysis, recorded_at, processed_at, created_at, error_message, processing_attempts, last_error_at, processing_started_at',
  // Note list view (no analysis blob)
  NOTES_LIST: 'id, user_id, audio_url, duration_seconds, recorded_at, processed_at, created_at',
  // Note with analysis
  NOTES_WITH_ANALYSIS: 'id, user_id, transcription, analysis, recorded_at, processed_at, created_at',
  // Minimal note (for existence checks)
  NOTES_MINIMAL: 'id, user_id, processed_at',

  // Task states
  TASK_STATES_FULL: 'id, user_id, task_id, note_id, completed, completed_at, pinned, pinned_at, pin_order, archived, archived_at, created_at, updated_at',
  TASK_STATES_PIN: 'id, user_id, task_id, note_id, pinned, pin_order, pinned_at',
  TASK_STATES_COMPLETION: 'id, user_id, task_id, completed, completed_at',

  // Project knowledge
  PROJECT_KNOWLEDGE_FULL: 'id, user_id, content, updated_at',

  // Processing errors
  PROCESSING_ERRORS_FULL: 'id, note_id, error_message, error_type, stack_trace, processing_attempt, created_at',
} as const;

// Error messages for better debugging
export const DATABASE_ERRORS = {
  TABLE_NOT_FOUND: (tableName: string) => `Table '${tableName}' does not exist. Check database schema.`,
  FUNCTION_NOT_FOUND: (functionName: string) => `Function '${functionName}' does not exist. Check database migrations.`,
  COLUMN_NOT_FOUND: (tableName: string, columnName: string) => `Column '${columnName}' does not exist in table '${tableName}'.`,
  INVALID_TABLE_REFERENCE: (tableName: string) => `Invalid table reference '${tableName}'. Use constants from TABLES.`,
  SCHEMA_MISMATCH: 'Database schema does not match expected structure. Run migrations.',
} as const;