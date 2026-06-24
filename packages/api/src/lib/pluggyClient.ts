const PLUGGY_API = "https://api.pluggy.ai";

export interface PluggyAccount {
  id: string;
  itemId: string;
  name: string;
  type: "BANK" | "CREDIT" | "INVESTMENT";
  subtype: string;
  balance: number;
  currencyCode: string;
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  date: string; // ISO 8601
  category?: string;
}

interface PluggyPagedResult<T> {
  results: T[];
  totalPages: number;
  page: number;
}

async function pluggyFetch<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${PLUGGY_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Pluggy API error ${res.status}: ${body.message ?? res.statusText}`);
  }

  return res.json();
}

export async function getPluggyApiKey(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET not configured");
  }

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`Pluggy auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.apiKey as string;
}

export async function getConnectToken(apiKey: string): Promise<string> {
  const data = await pluggyFetch<{ accessToken: string }>(
    "/connect_token",
    apiKey,
    { method: "POST", body: JSON.stringify({}) }
  );
  return data.accessToken;
}

export async function getPluggyAccounts(
  apiKey: string,
  itemId: string
): Promise<PluggyAccount[]> {
  const data = await pluggyFetch<PluggyPagedResult<PluggyAccount>>(
    `/accounts?itemId=${encodeURIComponent(itemId)}`,
    apiKey
  );
  return data.results;
}

export async function getPluggyTransactions(
  apiKey: string,
  accountId: string,
  from: string,
  to: string
): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      accountId,
      from,
      to,
      page: String(page),
      pageSize: "500",
    });
    const data = await pluggyFetch<PluggyPagedResult<PluggyTransaction>>(
      `/transactions?${params}`,
      apiKey
    );
    all.push(...data.results);
    totalPages = data.totalPages;
    page++;
  }

  return all;
}
