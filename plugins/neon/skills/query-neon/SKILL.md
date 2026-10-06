---
name: query-neon
description: Answer a question from a Neon Postgres database, or change data in one, without touching the wrong branch — find the project and branch first, read the schema before writing SQL, and treat every write to a production branch as a change that needs the user's go-ahead. Use when the user asks what is in the database, asks to look up a row, a user, a count or a schema, or asks to run or fix SQL on Neon.
argument-hint: the question to answer or the change to make
allowed-tools: mcp__neon__*
---

# Query Neon without surprises

The tools run SQL with the connection's own role, which can write. Nothing
stops a careless `update`. The job is to be sure which database you are in and
what the statement touches before it runs.

## 1. Name the project and the branch

`list_projects` first; `describe_project` shows its branches and which one is
the default. Pass `project_id` and `branch_id` on every call after that. An
omitted `branch_id` means the default branch, which is usually production. Say
which project and branch you are reading in the answer.

## 2. Read the schema before you write SQL

`get_database_tables`, then `describe_table_schema` for the tables you need.
Do not guess column names from the question. Tables may sit outside `public`;
check the schema name.

## 3. Reads

`run_sql` with a `select`. Add a `limit` unless the user asked for everything.
For a count or an aggregate, say what the `where` clause was, so the number can
be checked.

## 4. Writes

Before any `insert`, `update`, `delete` or DDL on a production branch:

1. Run the matching `select` with the same `where` and show how many rows it
   hits.
2. State the exact statement and get the user's go-ahead, unless they already
   gave the exact change.
3. Use `run_sql_transaction` when more than one statement must land together.
4. Read the rows back afterwards and report what changed.

For a schema change, prefer `prepare_database_migration`: it applies the change
on a temporary branch first, and `complete_database_migration` applies it for
real only after it is checked.

## Anti-patterns

- An `update` or `delete` with no `where`, or with one you did not test as a
  `select` first.
- Creating a branch, a role or a project to "try something". These cost money
  and stay until someone deletes them. Ask first.
- Printing a connection string. `get_connection_string` returns a password.
