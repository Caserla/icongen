import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';
const tables = new Set(['profiles', 'icon_projects', 'project_svg_icon_sets', 'project_svg_icons', 'library_favorites', 'generation_jobs']);
const databases = new Map();
const field = (key) => {
  if (!/^[a-z_]+$/.test(key)) throw new Error('Unsupported local field');
  return `json_extract(data, '$.${key}')`;
};
const scalar = (value) => typeof value === 'boolean' ? Number(value) : value;

export function openLocalDatabase(directory = process.env.EASY_ICON_DATA_DIR || resolve(process.cwd(), '../../.local/easy-icon')) {
  const path = resolve(directory, 'workspace.sqlite');
  if (databases.has(path)) return databases.get(path);
  mkdirSync(resolve(directory), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, key TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(kind,key));
    CREATE INDEX IF NOT EXISTS owner_index ON records(kind,json_extract(data,'$.user_id'));
    CREATE INDEX IF NOT EXISTS project_index ON records(kind,json_extract(data,'$.project_id'));
    CREATE INDEX IF NOT EXISTS set_index ON records(kind,json_extract(data,'$.set_id'));
    CREATE UNIQUE INDEX IF NOT EXISTS project_name_unique ON records(json_extract(data,'$.user_id'),lower(json_extract(data,'$.name'))) WHERE kind='icon_projects';`);
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO records VALUES (?,?,?)').run('profiles', LOCAL_USER_ID, JSON.stringify({id: LOCAL_USER_ID, email:'local@localhost', display_name:'Local', status:'active', created_at:now, updated_at:now}));
  databases.set(path, db);
  return db;
}

class LocalQuery {
  constructor(db, table) {
    if (!tables.has(table)) throw new Error(`Table unavailable in local mode: ${table}`);
    this.db = db; this.table = table; this.filters = []; this.values = [table]; this.sorts = []; this.columns = '*'; this.mode = 'read'; this.offset = 0; this.size = null; this.shape = 'list';
  }
  select(columns = '*', options = {}) { this.columns = columns; this.head = options.head; return this; }
  eq(key, value) { this.filters.push(`${field(key)} = ?`); this.values.push(scalar(value)); return this; }
  lte(key, value) { this.filters.push(`${field(key)} <= ?`); this.values.push(scalar(value)); return this; }
  is(key, value) { if (value !== null) throw new Error('Unsupported local is'); this.filters.push(`${field(key)} IS NULL`); return this; }
  not(key, operator, value) { if (operator !== 'is' || value !== null) throw new Error('Unsupported local not'); this.filters.push(`${field(key)} IS NOT NULL`); return this; }
  in(key, values) { this.filters.push(values.length ? `${field(key)} IN (${values.map(()=>'?').join(',')})` : '0'); this.values.push(...values.map(scalar)); return this; }
  order(key, {ascending = true} = {}) { this.sorts.push(`${field(key)} ${ascending ? 'ASC' : 'DESC'}`); return this; }
  range(start, end) { this.offset = start; this.size = end - start + 1; return this; }
  limit(size) { this.size = size; return this; }
  single() { this.shape = 'single'; return this; }
  maybeSingle() { this.shape = 'maybe'; return this; }
  insert(rows) { this.mode = 'insert'; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows, options = {}) { this.insert(rows); this.mode = 'upsert'; this.options = options; return this; }
  update(patch) { this.mode = 'update'; this.patch = patch; return this; }
  delete() { this.mode = 'delete'; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
  execute() {
    let transaction = false;
    try {
      const where = ['kind = ?', ...this.filters].join(' AND ');
      if (this.mode !== 'read') { this.db.exec('BEGIN IMMEDIATE'); transaction = true; }
      let rows;
      if (this.mode === 'insert' || this.mode === 'upsert') {
        rows = this.rows.map(input => {
          const now = new Date().toISOString();
          const row = {id:randomUUID(), created_at:now, updated_at:now, ...input};
          if (this.table === 'icon_projects') Object.assign(row, {theme:null, ai_theme:null, custom_theme:null, theme_status:'pending', theme_source:'preset'}, input);
          if (this.table === 'project_svg_icon_sets' || this.table === 'project_svg_icons') Object.assign(row, {is_favorite:false, recycled_at:null, canvas_position:null, generation_context:null, style_variants:null}, input);
          if (this.table === 'project_svg_icon_sets' && !this.db.prepare("SELECT 1 FROM records WHERE kind='icon_projects' AND key=?").get(row.project_id)) throw new Error('Parent project missing');
          if (this.table === 'project_svg_icons') {
            if (!this.db.prepare("SELECT 1 FROM records WHERE kind='project_svg_icon_sets' AND key=?").get(row.set_id)) throw new Error('Parent icon set missing');
          }
          const keys = (this.options?.onConflict || (this.table === 'project_svg_icons' ? 'set_id,subject_id' : this.table === 'library_favorites' ? 'user_id,asset_id' : 'id')).split(',');
          const existing = this.db.prepare(`SELECT key,data FROM records WHERE kind=? AND ${keys.map(k=>`${field(k)} = ?`).join(' AND ')}`).get(this.table, ...keys.map(k=>row[k]));
          if (existing && this.mode === 'upsert') {
            if (this.options?.ignoreDuplicates) return JSON.parse(existing.data);
            const merged = {...JSON.parse(existing.data), ...input, updated_at:now};
            this.db.prepare('UPDATE records SET data=? WHERE kind=? AND key=?').run(JSON.stringify(merged), this.table, existing.key); return merged;
          }
          if (this.table === 'icon_projects' && this.db.prepare("SELECT count(*) AS count FROM records WHERE kind='icon_projects' AND json_extract(data,'$.user_id')=?").get(row.user_id).count >= 20) throw new Error('PROJECT_LIMIT_REACHED');
          const key = keys.map(k=>row[k]).join(':');
          this.db.prepare('INSERT INTO records VALUES (?,?,?)').run(this.table, key, JSON.stringify(row)); return row;
        });
      } else {
        const page = this.mode === 'read' && this.size !== null ? ` LIMIT ${Math.max(0, Math.trunc(this.size))} OFFSET ${Math.max(0, Math.trunc(this.offset))}` : '';
        const records = this.db.prepare(`SELECT key,data FROM records WHERE ${where}${this.sorts.length ? ' ORDER BY '+this.sorts.join(',') : ''}${page}`).all(...this.values);
        rows = records.map(record => JSON.parse(record.data));
        if (this.mode === 'update') {
          rows = rows.map((row, i) => {
            const updated = {...row, ...this.patch, updated_at:new Date().toISOString()};
            this.db.prepare('UPDATE records SET data=? WHERE kind=? AND key=?').run(JSON.stringify(updated), this.table, records[i].key); return updated;
          });
        }
        if (this.mode === 'delete') {
          for (const record of records) {
            const row = JSON.parse(record.data);
            if (this.table === 'icon_projects') {
              this.db.prepare("DELETE FROM records WHERE kind='project_svg_icons' AND json_extract(data,'$.set_id') IN (SELECT key FROM records WHERE kind='project_svg_icon_sets' AND json_extract(data,'$.project_id')=?)").run(row.id);
              this.db.prepare("DELETE FROM records WHERE kind='project_svg_icon_sets' AND json_extract(data,'$.project_id')=?").run(row.id);
            }
            if (this.table === 'project_svg_icon_sets') this.db.prepare("DELETE FROM records WHERE kind='project_svg_icons' AND json_extract(data,'$.set_id')=?").run(row.id);
            this.db.prepare('DELETE FROM records WHERE kind=? AND key=?').run(this.table, record.key);
          }
        }
      }
      if (transaction) { this.db.exec('COMMIT'); transaction = false; }
      const count = rows.length;
      if (this.mode !== 'read' || this.size === null) rows = rows.slice(this.offset, this.size === null ? undefined : this.offset + this.size);
      if (this.columns !== '*') {
        if (/[():]/.test(this.columns) && rows.length) throw new Error('Nested legacy query unavailable locally');
        rows = rows.map(row => Object.fromEntries(this.columns.split(',').map(key=>[key.trim(), row[key.trim()] ?? null])));
      }
      if (this.shape === 'single' && rows.length !== 1 || this.shape === 'maybe' && rows.length > 1) return {data:null, error:{code:'PGRST116',message:'Expected one local record'},count};
      return {data:this.head ? null : this.shape === 'list' ? rows : rows[0] ?? null,error:null,count};
    } catch (error) {
      if (transaction) this.db.exec('ROLLBACK');
      return {data:null,error:{code:error.message.includes('UNIQUE') ? '23505' : 'LOCAL_DATABASE_ERROR',message:error.message},count:null};
    }
  }
}

export function createLocalClient(directory) {
  const db = openLocalDatabase(directory);
  const user = {id:LOCAL_USER_ID, email:'local@localhost', email_confirmed_at:'2026-01-01T00:00:00Z', app_metadata:{}, user_metadata:{}, aud:'authenticated', created_at:'2026-01-01T00:00:00Z'};
  return {
    from: table => new LocalQuery(db, table),
    auth: {getUser:async()=>({data:{user},error:null}),signOut:async()=>({error:null})},
    rpc: async()=>({data:null,error:{code:'LOCAL_UNSUPPORTED',message:'Legacy RPC is unavailable in local mode'}}),
  };
}
