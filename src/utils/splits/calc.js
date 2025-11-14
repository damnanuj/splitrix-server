// Utilities to compute split details and balances for various split types

export function calculateEqualSplits({ amount, payerId, participantIds }) {
  const perHead = amount / participantIds.length;
  return participantIds
    .filter((uid) => String(uid) !== String(payerId))
    .map((uid) => ({ from: uid, to: payerId, amount: perHead }));
}

export function calculateUnequalSplits({ payerId, shares }) {
  // shares: [{ user, amount }]
  return shares
    .filter((s) => String(s.user) !== String(payerId) && s.amount > 0)
    .map((s) => ({ from: s.user, to: payerId, amount: s.amount }));
}

export function calculateShareWeightSplits({ amount, payerId, shares }) {
  // shares: [{ user, weight }]
  const total = shares.reduce((sum, s) => sum + (s.weight || 0), 0);
  return shares
    .filter((s) => String(s.user) !== String(payerId))
    .map((s) => ({ from: s.user, to: payerId, amount: (amount * (s.weight || 0)) / (total || 1) }));
}

export function calculateItemizedSplits({ items }) {
  // items: [{ amount, paidBy, involved: [userIds] }]
  // returns flattened {from,to,amount} where from is each involved except payer
  const lines = [];
  for (const item of items) {
    const perHead = item.amount / item.involved.length;
    for (const userId of item.involved) {
      if (String(userId) !== String(item.paidBy)) {
        lines.push({ from: userId, to: item.paidBy, amount: perHead });
      }
    }
  }
  return lines;
}

export function mergeSplits(splits) {
  // combine duplicates (same from,to)
  const key = (s) => `${String(s.from)}->${String(s.to)}`;
  const map = new Map();
  for (const s of splits) {
    const k = key(s);
    map.set(k, (map.get(k) || 0) + s.amount);
  }
  return Array.from(map.entries()).map(([k, amount]) => {
    const [from, to] = k.split("->");
    return { from, to, amount };
  });
}

export function simplifyDebts(splits) {
  // netting algorithm to reduce number of transfers
  const balances = new Map();
  for (const { from, to, amount } of splits) {
    balances.set(String(from), (balances.get(String(from)) || 0) - amount);
    balances.set(String(to), (balances.get(String(to)) || 0) + amount);
  }
  const debtors = [];
  const creditors = [];
  for (const [userId, bal] of balances.entries()) {
    if (Math.abs(bal) < 1e-6) continue;
    if (bal < 0) debtors.push({ userId, amount: -bal });
    else creditors.push({ userId, amount: bal });
  }
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amt = Math.min(d.amount, c.amount);
    transfers.push({ from: d.userId, to: c.userId, amount: amt });
    d.amount -= amt;
    c.amount -= amt;
    if (d.amount <= 1e-6) i++;
    if (c.amount <= 1e-6) j++;
  }
  return transfers;
}


