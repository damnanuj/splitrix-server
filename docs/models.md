## Models

### User
Fields: `name`, `email`, `password`, `profilePicture`, `friends[]`

### Group
Fields: `name`, `createdBy`, `members[]`, `description`, `avatar`

### Invite
Fields: `group`, `invitedBy`, `invitedUser`, `status`, `message`

### Notification
Fields: `user`, `type`, `title`, `message`, `data`, `readAt`

### Activity
Fields: `group`, `actor`, `type`, `summary`, `data`

### Bill
Fields: `title`, `amount`, `group`, `category`, `paidBy`, `participants[]`, `involved[]`, `splitType`, `shares[]`, `items[]`, `splitDetails[]`, `note`

### Settlement
Fields: `group`, `from`, `to`, `amount`, `note`, `billRef`


