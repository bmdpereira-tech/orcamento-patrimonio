import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar o seed.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const INITIAL_MONTH = "2026-07-01";

const { data: existingCashAccount, error: existingCashAccountError } = await supabase
  .from("accounts")
  .select("id")
  .eq("name", "T212 Cash")
  .maybeSingle();

if (existingCashAccountError) {
  throw existingCashAccountError;
}

if (!existingCashAccount) {
  const { data: legacyCashAccounts, error: legacyCashAccountsError } = await supabase
    .from("accounts")
    .select("id")
    .in("name", ["Trading 212 Disponivel", "Trading 212 Disponível"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (legacyCashAccountsError) {
    throw legacyCashAccountsError;
  }

  const legacyCashAccount = legacyCashAccounts?.[0];

  if (legacyCashAccount) {
    const { error: legacyCashUpdateError } = await supabase
      .from("accounts")
      .update({ name: "T212 Cash" })
      .eq("id", legacyCashAccount.id);

    if (legacyCashUpdateError) {
      throw legacyCashUpdateError;
    }
  }
}

await supabase
  .from("investment_assets")
  .update({ name: "Trading 212 — Investimentos" })
  .eq("name", "Trading 212 - Investimentos");

const baseAccounts = [
  {
    name: "Santander",
    short_name: "Santander",
    account_type: "bank_account",
    is_credit_card: false,
    start_month: INITIAL_MONTH,
    sort_order: 10,
    show_in_budget: true,
    include_in_net_worth: true,
  },
  {
    name: "ActivoBank",
    short_name: "ActivoBank",
    account_type: "bank_account",
    is_credit_card: false,
    start_month: INITIAL_MONTH,
    sort_order: 30,
    show_in_budget: true,
    include_in_net_worth: true,
  },
  {
    name: "T212 Cash",
    short_name: "T212 Cash",
    account_type: "investment_cash",
    is_credit_card: false,
    start_month: INITIAL_MONTH,
    sort_order: 50,
    show_in_budget: true,
    include_in_net_worth: true,
  },
  {
    name: "N26",
    short_name: "N26",
    account_type: "bank_account",
    is_credit_card: false,
    start_month: INITIAL_MONTH,
    sort_order: 60,
    show_in_budget: true,
    include_in_net_worth: true,
  },
  {
    name: "IGCP",
    short_name: "IGCP",
    account_type: "savings",
    is_credit_card: false,
    start_month: INITIAL_MONTH,
    sort_order: 70,
    show_in_budget: true,
    include_in_net_worth: true,
  },
];

const { error: baseAccountsError } = await supabase.from("accounts").upsert(baseAccounts, {
  onConflict: "name",
});

if (baseAccountsError) {
  throw baseAccountsError;
}

const { data: paymentAccounts, error: paymentAccountsError } = await supabase
  .from("accounts")
  .select("id,name")
  .in("name", ["Santander", "ActivoBank"]);

if (paymentAccountsError) {
  throw paymentAccountsError;
}

const accountIdByName = new Map(paymentAccounts?.map((account) => [account.name, account.id]) ?? []);

const creditCards = [
  {
    name: "CC Santander",
    short_name: "CC Santander",
    account_type: "credit_card",
    is_credit_card: true,
    linked_payment_account_id: accountIdByName.get("Santander"),
    start_month: INITIAL_MONTH,
    sort_order: 20,
    show_in_budget: true,
    include_in_net_worth: true,
  },
  {
    name: "CC ActivoBank",
    short_name: "CC ActivoBank",
    account_type: "credit_card",
    is_credit_card: true,
    linked_payment_account_id: accountIdByName.get("ActivoBank"),
    start_month: INITIAL_MONTH,
    sort_order: 40,
    show_in_budget: true,
    include_in_net_worth: true,
  },
];

const { error: creditCardsError } = await supabase.from("accounts").upsert(creditCards, {
  onConflict: "name",
});

if (creditCardsError) {
  throw creditCardsError;
}

const { error: assetError } = await supabase.from("investment_assets").upsert(
  {
    name: "Trading 212 — Investimentos",
    start_month: INITIAL_MONTH,
    sort_order: 10,
  },
  { onConflict: "name" },
);

if (assetError) {
  throw assetError;
}

const { error: settingsError } = await supabase.from("app_settings").upsert(
  {
    key: "initial_month",
    value: INITIAL_MONTH,
  },
  { onConflict: "key" },
);

if (settingsError) {
  throw settingsError;
}

console.log("Seed inicial concluído sem saldos pessoais.");
