// One Durable Object (SQLite storage) that keeps counters: questions per student per day,
// spending per month, failed logins, and the cached embeddings index.
// It never stores question text, answers or audio.
import { DurableObject } from "cloudflare:workers";

export class Ledger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec("CREATE TABLE IF NOT EXISTS usage (day TEXT, login TEXT, n INTEGER, PRIMARY KEY (day, login))");
      this.sql.exec("CREATE TABLE IF NOT EXISTS spend (month TEXT PRIMARY KEY, micro INTEGER)");
      this.sql.exec("CREATE TABLE IF NOT EXISTS fails (login TEXT PRIMARY KEY, n INTEGER, since INTEGER)");
      this.sql.exec("CREATE TABLE IF NOT EXISTS blobs (k TEXT PRIMARY KEY, v TEXT)");
    });
  }

  spentMicro(month) {
    const row = this.sql.exec("SELECT micro FROM spend WHERE month = ?", month).toArray()[0];
    return row ? row.micro : 0;
  }

  /** Counts one AI question if the student is under the daily limit and the month is under budget. */
  reserve(login, day, dailyLimit, month, budgetMicro) {
    if (this.spentMicro(month) >= budgetMicro) return { ok: false, reason: "budget" };
    const row = this.sql.exec("SELECT n FROM usage WHERE day = ? AND login = ?", day, login).toArray()[0];
    const used = row ? row.n : 0;
    if (used >= dailyLimit) return { ok: false, reason: "limit", used };
    this.sql.exec("INSERT INTO usage (day, login, n) VALUES (?, ?, 1) ON CONFLICT (day, login) DO UPDATE SET n = n + 1", day, login);
    return { ok: true, used: used + 1 };
  }

  /**
   * Like reserve(), for a feature with its own daily count and (optionally) its own monthly budget,
   * e.g. kind "voice" (speech-to-text) or "tts" (AI voice). Spending of every kind also counts
   * toward the overall monthly budget.
   */
  reserveKind(kind, login, day, dailyLimit, month, totalBudgetMicro, kindBudgetMicro) {
    if (this.spentMicro(month) >= totalBudgetMicro) return { ok: false, reason: "budget" };
    if (kindBudgetMicro > 0 && this.spentMicro(`${month}:${kind}`) >= kindBudgetMicro) return { ok: false, reason: "budget" };
    return this.reserve(`${login}:${kind}`, day, dailyLimit, month, totalBudgetMicro);
  }

  addSpendKind(kind, month, micro) {
    if (!(micro > 0)) return;
    this.addSpend(`${month}:${kind}`, micro);
    this.addSpend(month, micro);
  }

  /** Gives a reserved question back (used when nothing was spent, e.g. a declined question). */
  release(login, day) {
    this.sql.exec("UPDATE usage SET n = MAX(n - 1, 0) WHERE day = ? AND login = ?", day, login);
  }

  addSpend(month, micro) {
    if (!(micro > 0)) return this.spentMicro(month);
    this.sql.exec("INSERT INTO spend (month, micro) VALUES (?, ?) ON CONFLICT (month) DO UPDATE SET micro = micro + excluded.micro", month, Math.ceil(micro));
    return this.spentMicro(month);
  }

  status(month, day) {
    const voiceToday = this.sql.exec("SELECT COALESCE(SUM(n), 0) AS n FROM usage WHERE day = ? AND login LIKE '%:voice'", day).toArray()[0].n;
    const ttsToday = this.sql.exec("SELECT COALESCE(SUM(n), 0) AS n FROM usage WHERE day = ? AND login LIKE '%:tts'", day).toArray()[0].n;
    const textToday = this.sql.exec("SELECT COUNT(*) AS students, COALESCE(SUM(n), 0) AS questions FROM usage WHERE day = ? AND login NOT LIKE '%:%'", day).toArray()[0];
    return { month, spentMicro: this.spentMicro(month), voiceMicro: this.spentMicro(`${month}:voice`), ttsMicro: this.spentMicro(`${month}:tts`), today: { ...textToday, voice: voiceToday, tts: ttsToday } };
  }

  /** Allows at most maxFails wrong codes per login per window. */
  loginAllowed(login, now, maxFails, windowMs) {
    const row = this.sql.exec("SELECT n, since FROM fails WHERE login = ?", login).toArray()[0];
    if (!row || now - row.since > windowMs) return true;
    return row.n < maxFails;
  }
  recordLoginFail(login, now, windowMs) {
    const row = this.sql.exec("SELECT n, since FROM fails WHERE login = ?", login).toArray()[0];
    if (!row || now - row.since > windowMs) this.sql.exec("INSERT OR REPLACE INTO fails (login, n, since) VALUES (?, 1, ?)", login, now);
    else this.sql.exec("UPDATE fails SET n = n + 1 WHERE login = ?", login);
  }
  clearLoginFails(login) { this.sql.exec("DELETE FROM fails WHERE login = ?", login); }

  getBlob(k) { const row = this.sql.exec("SELECT v FROM blobs WHERE k = ?", k).toArray()[0]; return row ? row.v : null; }
  putBlob(k, v) { this.sql.exec("DELETE FROM blobs WHERE k LIKE 'index:%' AND k != ?", k); this.sql.exec("INSERT OR REPLACE INTO blobs (k, v) VALUES (?, ?)", k, v); }
}
