## Routes

Base path: `/api`

### Auth
- POST `/auth/signup`
  - Example:
```json
{
  "name": "Anuj",
  "email": "anuj@example.com",
  "password": "secret123"
}
```
- POST `/auth/login`
  - Example:
```json
{
  "email": "anuj@example.com",
  "password": "secret123"
}
```
- POST `/auth/google`
  - Example:
```json
{
  "email": "anuj@example.com",
  "name": "Anuj",
  "photo": "https://.../avatar.png"
}
```

### Users
- GET `/user/` (auth)
- GET `/user/:id` (auth)
- POST `/user/friends` (auth) — add friend (mutual)
  - Example:
```json
{
  "friendId": "664f7d2f1a2b3c4d5e6f7a8b"
}
```
- GET `/user/friends/list` (auth)

### Groups
- POST `/group/` (auth) — create group
  - Example:
```json
{
  "name": "Billionaires",
  "memberIds": ["6650aa...001", "6650aa...002"],
  "description": "Trip crew",
  "avatar": "https://.../group.png"
}
```
- GET `/group/mine` (auth)
- POST `/group/invite` (auth)
  - Example:
```json
{
  "groupId": "6650bb...123",
  "userId": "6650cc...456"
}
```
- POST `/group/invite/respond` (auth)
  - Example:
```json
{
  "inviteId": "6650dd...789",
  "action": "accepted"
}
```

### Bills
- POST `/bill/` (auth) — create bill with `splitType`
  - Equal split example:
```json
{
  "title": "Dinner",
  "amount": 500,
  "group": "6650bb...123",
  "paidBy": "6650aa...000",
  "participants": ["6650aa...000", "6650aa...001", "6650aa...002"],
  "splitType": "equal"
}
```
  - Unequal split example:
```json
{
  "title": "Dinner",
  "amount": 500,
  "group": "6650bb...123",
  "paidBy": "6650aa...000",
  "participants": ["6650aa...000", "6650aa...001", "6650aa...002"],
  "splitType": "unequal",
  "shares": [
    { "user": "6650aa...000", "amount": 120 },
    { "user": "6650aa...001", "amount": 150 },
    { "user": "6650aa...002", "amount": 230 }
  ]
}
```
  - Weighted shares example:
```json
{
  "title": "Groceries",
  "amount": 900,
  "group": "6650bb...123",
  "paidBy": "6650aa...001",
  "participants": ["6650aa...000", "6650aa...001", "6650aa...002"],
  "splitType": "shares",
  "shares": [
    { "user": "6650aa...000", "weight": 1 },
    { "user": "6650aa...001", "weight": 2 },
    { "user": "6650aa...002", "weight": 2 }
  ]
}
```
  - Itemized example (payer can vary per item; involved is per item):
```json
{
  "title": "Stationery",
  "amount": 100,
  "group": "6650bb...123",
  "paidBy": "6650aa...002",
  "participants": ["6650aa...001", "6650aa...002"],
  "splitType": "itemized",
  "items": [
    { "label": "Book", "amount": 70, "paidBy": "6650aa...002", "involved": ["6650aa...001"] },
    { "label": "Pen",  "amount": 30, "paidBy": "6650aa...002", "involved": ["6650aa...002"] }
  ]
}
```
  - Custom transfers example (explicit debts):
```json
{
  "title": "Custom",
  "amount": 0,
  "group": "6650bb...123",
  "paidBy": "6650aa...000",
  "participants": ["6650aa...000", "6650aa...001"],
  "splitType": "custom",
  "shares": [
    { "from": "6650aa...001", "to": "6650aa...000", "amount": 75 }
  ]
}
```
- GET `/bill/group/:groupId` (auth)

### Settlements
- POST `/settlement/` (auth)
  - Example:
```json
{
  "group": "6650bb...123",
  "from": "6650aa...002",
  "to": "6650aa...000",
  "amount": 230,
  "note": "Dinner payback"
}
```
- GET `/settlement/group/:groupId` (auth)

### Balances
- GET `/balance/group/:groupId` (auth)
- GET `/balance/me` (auth)


