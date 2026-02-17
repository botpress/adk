# Events

## Trigger Events (Frontend → Bot)

### `harmfulTrigger`
- **Triggered by:** Reviews loaded (file upload or demo data)
- **Payload:** `{ type: 'harmfulTrigger', reviews }`
- **Affects:** `analyticsData.problems`

### `imbalanceTrigger`
- **Triggered by:** Reviews loaded (file upload or demo data)
- **Payload:** `{ type: 'imbalanceTrigger', reviews }`
- **Affects:** `analyticsData.polarizingTopics`

### `departmentTrigger`
- **Triggered by:** Reviews loaded OR "Regenerate Scores" button
- **Payload:** `{ type: 'departmentTrigger', reviews, departments? }`
- **Affects:** `analyticsData.departmentScores`

> Note: `departments` is optional. When triggered by review load, departments are auto-detected by the bot. When triggered manually, the user's selected departments are passed.

## Result Events (Bot → Frontend)

| Event Type | Updates State |
|------------|---------------|
| `problemsResult` | `analyticsData.problems` |
| `polarizingResult` | `analyticsData.polarizingTopics` |
| `departmentsResult` | `analyticsData.departmentScores` |
