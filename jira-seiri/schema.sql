CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    key         TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    synced_at   DATETIME
);

CREATE TABLE IF NOT EXISTS issue_types (
    id               TEXT PRIMARY KEY,
    project_key      TEXT NOT NULL,
    name             TEXT NOT NULL,
    hierarchy_level  INTEGER NOT NULL DEFAULT 0,
    subtask          INTEGER NOT NULL DEFAULT 0 CHECK (subtask IN (0, 1)),
    UNIQUE (project_key, name),
    FOREIGN KEY (project_key) REFERENCES projects(key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issues (
    key              TEXT PRIMARY KEY,
    project_key      TEXT NOT NULL,
    parent_key       TEXT,
    summary          TEXT NOT NULL,
    description      TEXT,
    issue_type       TEXT NOT NULL,
    hierarchy_level  INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'To Do',
    priority         TEXT,
    story_points     REAL,
    jira_created_at  DATETIME,
    jira_updated_at  DATETIME,
    synced_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_key) REFERENCES projects(key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS issue_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key  TEXT NOT NULL,
    target_key  TEXT NOT NULL,
    link_type   TEXT NOT NULL,
    UNIQUE (source_key, target_key, link_type)
);

CREATE TABLE IF NOT EXISTS migrations (
    filename     TEXT PRIMARY KEY,
    description  TEXT,
    version      INTEGER NOT NULL DEFAULT 1,
    checksum     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SUCCESS', 'PARTIAL', 'FAILED')),
    applied_at   DATETIME
);

CREATE TABLE IF NOT EXISTS migration_items (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_filename   TEXT NOT NULL,
    operation_index      INTEGER NOT NULL,
    local_ref            TEXT,
    action               TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'LINK')),
    issue_type           TEXT,
    parent_key           TEXT,
    summary              TEXT NOT NULL,
    status               TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'CREATED', 'UPDATED', 'LINKED', 'SKIPPED_DUPLICATE', 'FAILED')),
    issue_key            TEXT,
    error                TEXT,
    executed_at          DATETIME,
    UNIQUE (migration_filename, operation_index),
    FOREIGN KEY (migration_filename) REFERENCES migrations(filename) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS issues_fts USING fts5(
    key,
    summary,
    description,
    content='issues',
    content_rowid='rowid',
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS issues_ai AFTER INSERT ON issues BEGIN
    INSERT INTO issues_fts (rowid, key, summary, description)
    VALUES (new.rowid, new.key, new.summary, new.description);
END;

CREATE TRIGGER IF NOT EXISTS issues_ad AFTER DELETE ON issues BEGIN
    INSERT INTO issues_fts (issues_fts, rowid, key, summary, description)
    VALUES ('delete', old.rowid, old.key, old.summary, old.description);
END;

CREATE TRIGGER IF NOT EXISTS issues_au AFTER UPDATE ON issues BEGIN
    INSERT INTO issues_fts (issues_fts, rowid, key, summary, description)
    VALUES ('delete', old.rowid, old.key, old.summary, old.description);
    INSERT INTO issues_fts (rowid, key, summary, description)
    VALUES (new.rowid, new.key, new.summary, new.description);
END;

CREATE INDEX IF NOT EXISTS idx_issues_project    ON issues(project_key);
CREATE INDEX IF NOT EXISTS idx_issues_parent     ON issues(parent_key);
CREATE INDEX IF NOT EXISTS idx_issues_status     ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_type_level ON issues(hierarchy_level, issue_type);
CREATE INDEX IF NOT EXISTS idx_issues_updated    ON issues(jira_updated_at);
CREATE INDEX IF NOT EXISTS idx_links_source      ON issue_links(source_key);
CREATE INDEX IF NOT EXISTS idx_links_target      ON issue_links(target_key);
CREATE INDEX IF NOT EXISTS idx_items_migration   ON migration_items(migration_filename);
CREATE INDEX IF NOT EXISTS idx_items_status      ON migration_items(status);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
