# Hotel Review Analytics

AI-powered analytics dashboard for hotel reviews built with **Botpress ADK** and **React**. <br>
This app shows how to use `zai.group()`, `zai.rate()`, and `zai.sort()`.

## What's in this file

This document covers:
- **Event flow** between the frontend and bot
- **Analysis pipelines** showing how reviews are processed using Zai methods
- **Data contracts** between bot responses and frontend components
- **Customization points** for adapting to other domains
- **Systems architecture** overview

---

## Trigger Events (Frontend → Bot)

There is a single `AnalysisTrigger` that handles all analysis requests via the `chat:custom` event channel. It routes based on the `type` field in the event payload.

### `fullAnalysisTrigger`
- **Triggered by:** User loads reviews (file upload or demo data)
- **Payload:** `{ type: 'fullAnalysisTrigger', reviews }`

**Flow:**
1. Extract atomic topics from all reviews using `zai.extract()`
2. Run three analyses **in parallel** using `Promise.all()`:
   - Issues Analysis → `issuesResponse`
   - Polarity Analysis → `polarityResponse`
   - Department Analysis → `departmentsResponse`

---

### `departmentTrigger`
- **Triggered by:** User clicks "Regenerate Scores" button with custom departments
- **Payload:** `{ type: 'departmentTrigger', reviews, departments? }`

**Flow:**
1. Extract atomic topics from all reviews
2. Run department analysis with custom departments (if provided)

> Note: `departments` is optional. When not provided, uses default hotel departments.

---

## Analysis Pipelines

### Issues Analysis (`analyzeIssues`)

| Step | Method | Description | Example |
|------|--------|-------------|---------|
| 1. Filter | `zai.filter()` | Keep only customer issues | `["Great location", "Noisy AC"]` → `["Noisy AC"]` |
| 2. Group | `zai.group()` | Cluster similar complaints together | `["Noisy AC", "AC broken"]` → `{ "HVAC Issues": [...] }` |
| 3. Stringify | `JSON.stringify()` | Prepare for sorting | Converts groups to JSON strings with metadata |
| 4. Sort | `zai.sort()` | Rank by business harm | Most harmful issues first |
| 5. Parse | `JSON.parse()` | Structure results for client | `{ topic, reviews }` |

### Polarity Analysis (`analyzePolarity`)

| Step | Method | Description | Example |
|------|--------|-------------|---------|
| 1. Group by aspect | `zai.group()` | Group atomic feedback into preset hotel aspects | `["Loved the pool", "Room was dirty"]` → `{ "Amenities": [...], "Cleanliness": [...] }` |
| 2. Split good/bad | `zai.group()` | Within each aspect, separate positive and negative feedback | `{ good: ["Loved it"], bad: ["Hated it"] }` |
| 3. Rate intensity | `zai.rate()` | Score each review's sentiment intensity (0-10) | `["Loved it!", "Was okay"]` → `[9, 3]` |
| 4. Sum scores | `.reduce()` | Sum ratings for positive and negative groups | `positiveScore: 24, negativeScore: 18` |
| 5. Compute polarity | arithmetic | `positiveScore / (positiveScore + negativeScore)` | `24 / 42 = 0.57` |
| 6. Sort by polarity | `.sort()` | Sort by distance from 0.5 (most unbalanced first) | `|0.8 - 0.5| > |0.6 - 0.5|` |

**Preset aspect groups:** Cleanliness, Location, Staff & Service, Food & Dining, Amenities, Value for Money, Noise & Quietness, Check-in & Check-out, Room Comfort & Size

### Department Analysis (`analyzeDepartments`)

| Step | Method | Description | Example |
|------|--------|-------------|---------|
| 1. Group by department | `zai.group()` | Group reviews by responsible department | Uses custom or default departments |
| 2. Rate feedback | `zai.rate()` | Rate how positive each review is | `["Great service", "Rude staff"]` → `[8, 2]` |
| 3. Average scores | arithmetic | Calculate average score per department | `scores.reduce() / scores.length` |

**Default departments:** Front Desk, Housekeeping, Restaurant, Events, Maintenance and Facilities, Recreation, Parking

---

## Response Events (Bot → Frontend)

### `issuesResponse`

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
    type: 'issuesResponse',
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
// ProblemsSection receives via `issues` prop:
[
  {
    topic: string,      // Issue description
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
        positiveScore: 34,
        negativeScore: 29,
        polarityScore: 0.54,
        positiveReviews: [
          "Loved the aesthetic",
          "Clean and modern"
        ],
        negativeReviews: [
          "Felt cold and sterile",
          "Too minimalist for my taste"
        ]
      }
    ]
  }
})
```

</td>
<td>

```javascript
// PolaritySection receives via `topics` prop:
[
  {
    topic: string,            // Topic name
    positiveScore: number,    // Sum of positive sentiment ratings
    negativeScore: number,    // Sum of negative sentiment ratings
    polarityScore: number,    // 0-1 ratio (positive / total)
    positiveReviews: string[],// Positive review evidence
    negativeReviews: string[] // Negative review evidence
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
        reviews: [
          "Check-in took forever",
          "Staff was friendly"
        ]
      }
    ]
  }
})
```

</td>
<td>

```javascript
// DepartmentScoresSection receives via `departments` prop:
[
  {
    department: string,  // Department name
    score: number,       // Average rating (0-10 scale)
    reviews: string[]    // Relevant reviews
  }
]
```

</td>
</tr>
</table>

---

## Shared: Atomic Topic Extraction

Before any analysis, reviews are split into atomic feedback points:

```javascript
async function extractAtomicTopics(reviewsContent: string[]): Promise<string[]> {
  const atomicTopics = await Promise.all(
    reviewsContent.map(review => adk.zai.extract(review, z.array(z.object({
      atomic_feedback: z.string()
    }))))
  )
  return atomicTopics.flatMap(topic => topic.map(entry => entry.atomic_feedback))
}
```

**Example:** `"Great location but noisy AC"` → `["Great location", "Noisy AC"]`

---

## Hotel Theme Implementation Details

The bot uses hotel-specific initial groups and instructions. To adapt for other domains, modify these:

### Polarity Groupings
`bot/src/triggers/index.ts:65-75`
```javascript
initialGroups: [
  { id: "cleanliness", label: "Cleanliness" },
  { id: "location", label: "Location" },
  { id: "staff", label: "Staff & Service" },
  { id: "food", label: "Food & Dining" },
  { id: "amenities", label: "Amenities (Pool, Gym, Spa)" },
  { id: "value", label: "Value for Money" },
  { id: "noise", label: "Noise & Quietness" },
  { id: "checkin", label: "Check-in & Check-out" },
  { id: "room", label: "Room Comfort & Size" }
]
```

### Department Groupings
`bot/src/triggers/index.ts:123-131`
```javascript
initialGroups: [
  { id: "frontdesk", label: "Front Desk" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "restaurant", label: "Restaurant" },
  { id: "events", label: "Events" },
  { id: "maintenance", label: "Maintenance and Facilities" },
  { id: "recreation", label: "Recreation" },
  { id: "parking", label: "Parking" }
]
```

### Grouping Instructions
`bot/src/triggers/index.ts`
| Analysis | Line | Instruction |
|----------|------|-------------|
| Issues | 27 | `"Group by type of customer issues"` |
| Polarity | 64 | `"Group by hotel aspect. Assign each review to the most relevant group."` |
| Departments | 140 | `"Group reviews by the department responsible for handling the issue or feedback mentioned"` |

---

## Systems Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                               │
│                                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────────────────────┐     │
│  │   App.jsx   │    │              Analytics View                     │     │
│  │             │    │  ┌─────────────┬─────────────┬───────────────┐  │     │
│  │ - Reviews   │───▶│  │  Issues     │  Polarity   │  Departments  │  │     │
│  │ - Analytics │    │  │  Section    │  Section    │  Section      │  │     │
│  │   State     │    │  └─────────────┴─────────────┴───────────────┘  │     │
│  └──────┬──────┘    └─────────────────────────────────────────────────┘     │
│         │                                                                   │
└─────────┼───────────────────────────────────────────────────────────────────┘
          │
          │  Botpress Chat API Client
          │  ├─ createEvent({ type, reviews, departments?})
          │  └─ listenConversation() → event_created
          │
┌─────────|───────────────────────────────────                         ────────────────────────────────┐
│         |                 BOTPRESS CLOUD                                                             │
│         |                                                                                            │
│  ┌──────|──────────────────────────────────                         ─────────────────────────────┐   │
│  │      |                                 AnalysisTrigger                                  │   │
│  │      ▼                                 (chat:custom)                                    │   │
│  │                                                                                               │   │
│  │   payload.type === fullAnalysisTrigger         payload.type === departmentTrigger             │   │
│  │          │                                                             │                     │   │
│  │          ▼                                                         ▼                          │   │
│  │   extractAtomicTopics()                                     extractAtomicTopics()             │   │
│  │          │                                                         │                          │   │
│  │          ▼                                                         ▼                          │   │
│  │   ┌──────────────┐                                          analyzeDepartments()              │   │
│  │   │ Promise.all  │                                                 │                          │   │
│  │   │              │                                                 ▼                          │   │
│  │   │ ┌──────────┐ │                                          departmentsResponse               │   │
│  │   │ │ analyze  │ │                                                   │   │
│  │   │ │ Issues   │─┼──▶ issuesResponse                                 │   │
│  │   │ └──────────┘ │                                                   │   │
│  │   │ ┌──────────┐ │                                                   │   │
│  │   │ │ analyze  │ │                                                   │   │
│  │   │ │ Polarity │─┼──▶ polarityResponse                               │   │
│  │   │ └──────────┘ │                                                   │   │
│  │   │ ┌──────────┐ │                                                   │   │
│  │   │ │ analyze  │ │                                                   │   │
│  │   │ │ Depts    │─┼──▶ departmentsResponse                            │   │
│  │   │ └──────────┘ │                                                   │   │
│  │   └──────────────┘                                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | Path | Purpose |
|-----------|------|---------|
| Bot Trigger | `bot/src/triggers/index.ts` | Handles events, runs analysis pipelines |
| Frontend App | `frontend/src/App.jsx` | State management, bot client connection |
| Issues View | `frontend/src/components/analytics/ProblemsSection.jsx` | Displays business-critical issues |
| Polarity View | `frontend/src/components/analytics/PolaritySection.jsx` | Displays sentiment balance |
| Departments View | `frontend/src/components/analytics/DepartmentScoresSection.jsx` | Displays department scores |
