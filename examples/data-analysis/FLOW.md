# Events

## Trigger Events (Frontend → Bot)

### `topicsTrigger`
- **Triggered by:** Reviews loaded (file upload or demo data)
- **Payload:** `{ type: 'topicsTrigger', reviews }`
- **Affects:** `analyticsData.topics`

**Pipeline:**

| Step | Method | Description | Example |
|------|--------|-------------|---------|
| 1. Extract | `zai.extract()` | Split each review into atomic feedback points | `"Great location but noisy AC"` → `["Great location", "Noisy AC"]` |
| 2. Filter | `zai.filter()` | Keep only customer issues | `["Great location", "Noisy AC"]` → `["Noisy AC"]` |
| 3. Group | `zai.group()` | Cluster similar complaints together | `["Noisy AC", "AC broken"]` → `{ "HVAC Issues": [...] }` |
| 4. Sort | `zai.sort()` | Rank by business impact (severity, frequency, sentiment) | Most harmful topics first |

### `polarityTrigger`
- **Triggered by:** Reviews loaded (file upload or demo data)
- **Payload:** `{ type: 'polarityTrigger', reviews }`
- **Affects:** `analyticsData.polarityTopics`

### `departmentTrigger`
- **Triggered by:** Reviews loaded OR "Regenerate Scores" button
- **Payload:** `{ type: 'departmentTrigger', reviews, departments? }`
- **Affects:** `analyticsData.departmentScores`

> Note: `departments` is optional. When triggered by review load, departments are auto-detected by the bot. When triggered manually, the user's selected departments are passed.

---

## Response Events (Bot → Frontend)

### `topicsResponse`

<table>
<tr>
<th>Bot sends</th>
<th>Frontend component expects</th>
</tr>
<tr>
<td>

```javascript
await actions.chat.sendEvent({
  conversationId: conversation.id,
  payload: {
    type: 'topicsResponse',
    data: [
      {
        topic: "Slow room service",
        reviews: [
          "Waited an hour for breakfast",
          "Room service took forever"
        ]
      }
    ]
  }
})
```

</td>
<td>

```javascript
// ProblemsSection receives:
[
  {
    topic: string,      // Topic description
    reviews: string[]   // Evidence (mention count = reviews.length)
  }
]
```

</td>
</tr>
</table>

---

### `polarityResponse`

<table>
<tr>
<th>Bot sends</th>
<th>Frontend component expects</th>
</tr>
<tr>
<td>

```javascript
await actions.chat.sendEvent({
  conversationId: conversation.id,
  payload: {
    type: 'polarityResponse',
    data: [
      {
        topic: "Modern minimalist decor",
        positiveCount: 34,
        negativeCount: 29,
        polarityScore: 85,
        positiveSample: "Loved the aesthetic",
        negativeSample: "Felt cold and sterile"
      }
    ]
  }
})
```

</td>
<td>

```javascript
// PolaritySection receives:
[
  {
    topic: string,         // Topic name
    positiveCount: number, // Positive mentions
    negativeCount: number, // Negative mentions
    polarityScore: number, // 0-100% split
    positiveSample: string,// Example positive quote
    negativeSample: string // Example negative quote
  }
]
```

</td>
</tr>
</table>

---

### `departmentsResponse`

<table>
<tr>
<th>Bot sends</th>
<th>Frontend component expects</th>
</tr>
<tr>
<td>

```javascript
await actions.chat.sendEvent({
  conversationId: conversation.id,
  payload: {
    type: 'departmentsResponse',
    data: [
      {
        department: "Front Desk",
        score: 3.2,
        reviewCount: 156,
        trend: "down",
        topIssue: "Long wait times"
      }
    ]
  }
})
```

</td>
<td>

```javascript
// DepartmentScoresSection receives:
[
  {
    department: string,  // Department name
    score: number,       // Score out of 5
    reviewCount: number, // Reviews for this dept
    trend: string,       // "up" | "down" | "stable"
    topIssue: string     // Main complaint
  }
]
```

</td>
</tr>
</table>
