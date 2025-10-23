## Splitrix Server Overview (Frontend Integration Guide)

This document summarizes the backend contract so the frontend can integrate quickly. For full details, also see `docs/models.md`, `docs/routes.md`, and `docs/flows.md`.

### Base URL
- Local: `http://localhost:PORT` (see `ENV.PORT`)
- All API endpoints are prefixed with `/api`

### Authentication
- JWT Bearer token
- Header: `Authorization: Bearer <token>`
- Obtain via:
  - POST `/api/auth/signup`
  - POST `/api/auth/login`
  - POST `/api/auth/google`

Successful auth returns:
```json
{
  "success": true,
  "token": "<JWT>",
  "user": { "id": "...", "name": "...", "email": "..." }
}
```

### Error/Success Envelope
- Success shape (typical):
```json
{ "success": true, "data": { /* or specific fields */ } }
```
- Error shape (typical):
```json
{ "success": false, "message": "Human-readable error" }
```

### Core Concepts and Models
- User: has `name`, `email`, `profilePicture`, `friends[]`
- Group: `name`, `createdBy`, `members[]`, optional `description`, `avatar`
- Invite: request for a user to join a group (`status`: pending/accepted/declined/expired)
- Bill: flexible splitting; supports `equal`, `unequal`, `shares` (weights), `itemized`, or `custom`
- Settlement: records a payment from one user to another within a group
- Notification: app-level events (invite sent/accepted, bill added, settlement)
- Activity: audit feed for groups

Bill fields important for UI:
- `title`, `amount`, `group`, `category`, `paidBy`, `participants[]`, `involved[]`
- `splitType`: `equal` | `unequal` | `shares` | `itemized` | `custom`
- `shares[]` (for `unequal` or `shares`) or `items[]` (for `itemized`)
- `splitDetails[]`: computed debts `{ from, to, amount }`

### High-Level Flows
1) Create Group → Invite Friends → Friends Accept → Add Bills → View Balances → Create Settlements
2) Bills can be added with different split strategies. The backend computes `splitDetails` and persists them.
3) Balances are computed from all bills and settlements in a group.

### Endpoints (Brief)
Auth
- POST `/api/auth/signup` — create account
- POST `/api/auth/login` — email+password
- POST `/api/auth/google` — Google login

Users (auth)
- GET `/api/user/` — list all users
- GET `/api/user/:id` — get user by id
- POST `/api/user/friends` — add friend (mutual)
- GET `/api/user/friends/list` — my friends (includes balance info per friend)

Groups (auth)
- POST `/api/group/` — create group
- GET `/api/group/mine` — my groups
- POST `/api/group/invite` — invite user
- POST `/api/group/invite/respond` — accept/decline

Bills (auth)
- POST `/api/bill/` — create bill (with `splitType`)
- GET `/api/bill/group/:groupId` — list group bills

Settlements (auth)
- POST `/api/settlement/` — record settlement
- GET `/api/settlement/group/:groupId` — list settlements

Balances (auth)
- GET `/api/balance/group/:groupId` — group balances
- GET `/api/balance/me` — my global net balance

For request/response payloads, see `docs/routes.md` (includes JSON examples for each endpoint).

### Categories and Split Types
- Categories: `general`, `food`, `grocery`, `travel`, `party`, `books`, `utilities`, `rent`, `other`
- Split types:
  - `equal`: evenly among `involved` (or `participants` when `involved` omitted)
  - `unequal`: provide `shares[{ user, amount }]`
  - `shares`: weighted ratios `shares[{ user, weight }]`
  - `itemized`: per-item `{ label, amount, paidBy, involved[] }`
  - `custom`: explicit debts `shares[{ from, to, amount }]`

### Notifications
- Types: `invite_sent`, `invite_accepted`, `invite_declined`, `group_joined`, `bill_added`, `settlement_made`
- The server stores notifications; frontend may poll a notifications feed in a future endpoint (not yet exposed). For now, react on responses after actions.

### Authorization Notes
- All non-auth endpoints require a valid JWT
- The `req.user.id` from JWT is used for ownership and visibility checks

### Performance/Consistency Notes
- `splitDetails` is stored per bill for deterministic history
- Group balance is derived from all `splitDetails` and `settlements`

### Examples At a Glance
- Unequal dinner (A=120, B=150, C=230, A paid 500):
  - POST `/api/bill/` with `splitType=unequal` and `shares=[{user:A,amount:120},{user:B,amount:150},{user:C,amount:230}]`
  - Backend stores `splitDetails`: `B->A:150`, `C->A:230`
- Itemized (B paid book 70 for C, and pen 30 for B):
  - `items=[{label:"Book",amount:70,paidBy:B,involved:[C]},{label:"Pen",amount:30,paidBy:B,involved:[B]}]`
  - `splitDetails`: `C->B:70`

### Frontend Checklist
- Persist JWT
- Attach `Authorization` header on protected requests
- Show group lists, member lists, invite flows
- Bill composer supporting the five split types
- Balances view per group, and a global net balance
- Trigger settlements and reflect in balances
- Friends list with balance indicators (who owes whom)


