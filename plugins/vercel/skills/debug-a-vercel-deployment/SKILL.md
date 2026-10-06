---
name: debug-a-vercel-deployment
description: Find why a Vercel deployment failed or misbehaves, from the build log or the runtime logs of the exact deployment, not from the latest one. Use when the user says a Vercel build failed, a preview or production URL errors or shows the wrong thing, or asks about deployments, logs, or project settings on Vercel.
argument-hint: the deployment URL, project name, or error
allowed-tools: mcp__vercel__*
---

# Debug the deployment the user means

## 1. Resolve the team and project

Projects live under teams, and the same project name can exist in more than one.
Use `list_teams`, then `list_projects` for the right team, and `get_project`
to confirm. If a team is missing, the connection was not granted access to it;
tell the user to reconnect Vercel and grant that team.

## 2. Pin one deployment

If the user gave a URL or deployment id, use `get_deployment` on it. If not,
`list_deployments` and pick by target (production or preview) and branch.
The newest deployment is often not the broken one. Report the deployment id,
commit, branch, and state you are looking at.

## 3. Read the log that matches the failure

- State `ERROR` or `CANCELED`: the cause is in the build. Read the build
  logs for that deployment and find the first error, not the last line. A later
  error is often a result of the first one.
- State `READY` but the site fails: use `get_runtime_errors` for grouped errors
  and affected routes, then `get_runtime_logs` filtered to that deployment and
  route for the request that failed.
- To see what the page actually returns, including protected previews, use
  `web_fetch_vercel_url`.

## 4. Say whether it is code or configuration

Many Vercel failures are not in the code: a missing environment variable for
that target, a wrong root directory or framework preset, or a Node version
change. Check the project settings before you propose a code change.

## 5. Ask before changing the platform

Redeploying, promoting or rolling back, and editing environment variables or
domains change what users get. State the change and get a yes first. An edited
environment variable takes effect only on the next deployment.
