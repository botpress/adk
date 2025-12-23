# clause-extraction

A Botpress Agent built with the ADK for extracting clauses from legal contracts.

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start development server:
   ```bash
   adk dev
   ```

3. Deploy your agent:
   ```bash
   adk deploy
   ```

## Project Structure

- `src/conversations/` - Webchat message handlers (analyze_contract, query_clauses tools)
- `src/workflows/` - Clause extraction workflow (4 phases: fetch → extract → review → store)
- `src/tables/` - Data storage (contracts, clauses, extractionActivity)
- `src/utils/` - Progress component, activity helpers, extraction logic
- `src/tools/` - AI-callable functions
- `src/actions/` - Reusable business logic

## Key Patterns

### Workflow Phases
1. **Fetch Passages** (0-10%) - Get RAG chunks from Files API
2. **Extract Clauses** (10-70%) - Parallel `zai.extract()` with `step.map()`
3. **Review & Consolidate** (70-85%) - Deduplicate across passages
4. **Store Results** (85-100%) - Batch insert to tables

### Progress Tracking
- Custom message component updated via `updateMessage()`
- Activities stored in table, merged on each update
- Frontend polls for real-time updates

### Tables
- `contractsTable` - Document metadata and status
- `clausesTable` - Extracted clauses (full-text searchable)
- `extractionActivityTable` - Workflow progress timeline

## Learn More

- [ADK Documentation](https://botpress.com/docs/adk)
- [Botpress Platform](https://botpress.com)
