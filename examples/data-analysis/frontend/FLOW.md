# Events

## Trigger Events (Frontend → Bot)

### `problemsTrigger`
- **Triggered by:** Reviews loaded (file upload or demo data)
- **Payload:** `{ type: 'problemsTrigger', reviews }`
- **Affects:** `analyticsData.problems`

### `polarityTrigger`
- **Triggered by:** Reviews loaded (file upload or demo data)
- **Payload:** `{ type: 'polarityTrigger', reviews }`
- **Affects:** `analyticsData.polarityTopics`

### `departmentTrigger`
- **Triggered by:** Reviews loaded OR "Regenerate Scores" button
- **Payload:** `{ type: 'departmentTrigger', reviews, departments? }`
- **Affects:** `analyticsData.departmentScores`

> Note: `departments` is optional. When triggered by review load, departments are auto-detected by the bot. When triggered manually, the user's selected departments are passed.

## Result Events (Bot → Frontend)

| Event Type | Updates State |
|------------|---------------|
| `problemsResponse` | `analyticsData.problems` |
| `polarityResponse` | `analyticsData.polarityTopics` |
| `departmentsResponse` | `analyticsData.departmentScores` |
