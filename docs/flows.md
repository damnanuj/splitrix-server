## Flows

### Example 1: Equal/Unequal Dinner
1. User A creates group `Billionaires` and invites B and C.
2. B and C accept.
3. A adds bill `Dinner 500` with splitType `unequal` and shares: A=120, B=150, C=230; paidBy A.
4. System records splitDetails: B->A:150, C->A:230.

### Example 2: Itemized Purchase (A not involved)
1. B adds bill `Stationery` itemized: Item1 Book 70 paidBy B involved [C]; Item2 Pen 30 paidBy B involved [B].
2. Split details: C->B:70. (No A involvement.)

### Settlements and Balances
1. C pays A 230 as settlement: POST /settlement.
2. Group balance recomputes; C net increases by -230, A by +230.


