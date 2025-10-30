# Knowledge Services

This directory contains the refactored service layer for the Knowledge API, extracted from the original 686-line route file for better organization and maintainability.

## Service Architecture

### Main Service
- **`KnowledgeService`** - Main orchestrator that coordinates all knowledge operations

### Supporting Services
- **`AuthenticationService`** - Handles both service key and anon key authentication
- **`NotesDataService`** - Manages notes data fetching and validation
- **`ProjectKnowledgeService`** - Handles project knowledge CRUD operations
- **`KnowledgeAggregatorService`** - Aggregates knowledge from notes with task completion states
- **`TaskStateService`** - Manages task states (existing service, imported)

### Utility Classes
- **`AggregationHelpers`** - Helper functions for data processing and aggregation
- **`CacheManager`** - Handles response caching logic
- **`ErrorHandler`** - Centralized error handling and logging

### Types
- **`KnowledgeTypes`** - All type definitions for knowledge operations

## Usage Example

```typescript
import { 
  KnowledgeService, 
  AuthenticationService, 
  CacheManager, 
  ErrorHandler 
} from '@/lib/services'

// In an API route
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization')
    const authContext = await AuthenticationService.authenticateFromHeader(authHeader)

    // Create service
    const knowledgeService = new KnowledgeService(authContext)

    // Get knowledge
    const knowledge = await knowledgeService.getCompleteKnowledge({
      includeProjectKnowledge: true,
      maxInsights: 50
    })

    // Return cached response
    const lastModified = await knowledgeService.getLastModified()
    return CacheManager.createCachedResponse(knowledge, notes, request.headers)

  } catch (error) {
    return ErrorHandler.handleServiceError(error, 'Knowledge API')
  }
}
```

## Benefits of Refactoring

### Before: Single 686-line route file
- Mixed concerns (auth, DB queries, aggregation, caching)
- Massive 264-line `aggregateKnowledgeFromNotes` function
- Difficult to test individual components
- Hard to maintain and extend
- Scattered error handling

### After: Clean service layer
- **Separation of Concerns**: Each service has a single responsibility
- **Testability**: Individual services can be unit tested
- **Maintainability**: Changes are localized to specific services
- **Reusability**: Services can be used in other parts of the application
- **Error Handling**: Centralized and consistent error management
- **Performance**: Optimized database queries and caching strategies

## Key Features Preserved

✅ **Dual Authentication**: Both service key and anon key support maintained  
✅ **Complete Knowledge Aggregation**: All 7-point AI analysis preserved  
✅ **Task Completion Integration**: Full task state management maintained  
✅ **Project Knowledge Management**: CRUD operations preserved  
✅ **Response Caching**: Optimized caching with proper headers  
✅ **Error Handling**: Comprehensive error recovery and logging  
✅ **Backward Compatibility**: All existing API behavior maintained  

## Performance Improvements

- **Optimized Database Queries**: Cleaner query organization
- **Better Error Handling**: Graceful degradation instead of failures
- **Improved Caching**: More efficient cache key generation and validation
- **Reduced Memory Usage**: Streaming and chunked processing where applicable
- **Better Resource Management**: Proper cleanup and connection handling

## Testing

Each service can be individually tested:

```typescript
// Test authentication
const authContext = await AuthenticationService.authenticateFromHeader(token)

// Test data fetching
const notesService = new NotesDataService(dbClient)
const notes = await notesService.getProcessedNotes(userId)

// Test aggregation
const aggregated = KnowledgeAggregatorService.aggregateFromNotes(notes, completionMap)

// Test caching
const cachedResponse = CacheManager.createCachedResponse(data, notes, headers)
```

## Future Enhancements

With this service architecture, future improvements become easier:

- **Background Processing**: Move heavy aggregation to background jobs
- **Caching Layers**: Add Redis or similar for improved caching
- **Rate Limiting**: Add per-user rate limiting at service level
- **Metrics Collection**: Add performance monitoring to each service
- **A/B Testing**: Easy to swap service implementations
- **Microservices**: Services can be extracted to separate deployments if needed