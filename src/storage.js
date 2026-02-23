const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

class Storage {
  constructor(dbPath) {
    const absolutePath = path.resolve(dbPath || './data/db.sqlite');
    const dir = path.dirname(absolutePath);
    fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(absolutePath);
    this.db.pragma('journal_mode = WAL');
    this._init();

    this.stmts = {
      upsertUser: this.db.prepare(`
        INSERT INTO users (tg_id, username, first_name, last_name, updated_at)
        VALUES (@tg_id, @username, @first_name, @last_name, CURRENT_TIMESTAMP)
        ON CONFLICT(tg_id)
        DO UPDATE SET
          username = excluded.username,
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          updated_at = CURRENT_TIMESTAMP
      `),
      getLatestSession: this.db.prepare(`
        SELECT *
        FROM sessions
        WHERE tg_id = ?
        ORDER BY id DESC
        LIMIT 1
      `),
      createSession: this.db.prepare(`
        INSERT INTO sessions (tg_id, status, current_question, answers_json, awaiting_user_question, result_due_at)
        VALUES (?, 'active', 1, '{}', 0, NULL)
      `),
      updateSessionProgress: this.db.prepare(`
        UPDATE sessions
        SET current_question = @current_question,
            answers_json = @answers_json,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `),
      updateSessionStatus: this.db.prepare(`
        UPDATE sessions
        SET status = @status,
            result_due_at = @result_due_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `),
      setAwaitingQuestion: this.db.prepare(`
        UPDATE sessions
        SET awaiting_user_question = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      setSessionFinished: this.db.prepare(`
        UPDATE sessions
        SET status = 'finished',
            awaiting_user_question = 0,
            result_due_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `),
      getSessionById: this.db.prepare(`
        SELECT * FROM sessions WHERE id = ? LIMIT 1
      `),
      getPendingResults: this.db.prepare(`
        SELECT *
        FROM sessions
        WHERE status = 'completed_pending_result'
          AND result_due_at IS NOT NULL
          AND result_due_at <= ?
      `),
      getFuturePendingResults: this.db.prepare(`
        SELECT *
        FROM sessions
        WHERE status = 'completed_pending_result'
          AND result_due_at IS NOT NULL
        ORDER BY result_due_at ASC
      `),
      insertLead: this.db.prepare(`
        INSERT INTO leads (session_id, tg_id, summary)
        VALUES (?, ?, ?)
      `),
      countLeads: this.db.prepare(`
        SELECT COUNT(*) AS total FROM leads
      `),
      lastLeads: this.db.prepare(`
        SELECT l.created_at, u.first_name
        FROM leads l
        LEFT JOIN users u ON u.tg_id = l.tg_id
        ORDER BY l.id DESC
        LIMIT 5
      `),
      getLeadBySession: this.db.prepare(`
        SELECT id FROM leads WHERE session_id = ? LIMIT 1
      `)
    };
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        tg_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tg_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_question INTEGER NOT NULL DEFAULT 1,
        answers_json TEXT NOT NULL DEFAULT '{}',
        awaiting_user_question INTEGER NOT NULL DEFAULT 0,
        result_due_at INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tg_id) REFERENCES users (tg_id)
      );

      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        tg_id INTEGER NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id),
        FOREIGN KEY (tg_id) REFERENCES users (tg_id)
      );
    `);
  }

  upsertUser(user) {
    this.stmts.upsertUser.run({
      tg_id: user.id,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null
    });
  }

  getLatestSession(tgId) {
    return this.stmts.getLatestSession.get(tgId) || null;
  }

  createSession(tgId) {
    const info = this.stmts.createSession.run(tgId);
    return this.getSessionById(info.lastInsertRowid);
  }

  updateSessionProgress(id, currentQuestion, answersObj) {
    this.stmts.updateSessionProgress.run({
      id,
      current_question: currentQuestion,
      answers_json: JSON.stringify(answersObj)
    });
  }

  updateSessionStatus(id, status, resultDueAt = null) {
    this.stmts.updateSessionStatus.run({ id, status, result_due_at: resultDueAt });
  }

  setAwaitingUserQuestion(id, value) {
    this.stmts.setAwaitingQuestion.run(value ? 1 : 0, id);
  }

  setSessionFinished(id) {
    this.stmts.setSessionFinished.run(id);
  }

  getSessionById(id) {
    return this.stmts.getSessionById.get(id) || null;
  }

  getPendingResults(nowMs) {
    return this.stmts.getPendingResults.all(nowMs);
  }

  getFuturePendingResults() {
    return this.stmts.getFuturePendingResults.all();
  }

  hasLeadForSession(sessionId) {
    return Boolean(this.stmts.getLeadBySession.get(sessionId));
  }

  insertLead(sessionId, tgId, summary) {
    this.stmts.insertLead.run(sessionId, tgId, summary);
  }

  getLeadsCount() {
    return this.stmts.countLeads.get().total;
  }

  getLastLeads() {
    return this.stmts.lastLeads.all();
  }

  parseAnswers(session) {
    if (!session || !session.answers_json) {
      return {};
    }

    try {
      return JSON.parse(session.answers_json);
    } catch {
      return {};
    }
  }
}

module.exports = { Storage };
