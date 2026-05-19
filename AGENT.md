# 🤖 AI Agent Guidelines: Isolated Monorepo Context

> [!IMPORTANT]
> **READ THIS BEFORE PROCEEDING WITH ANY CODE CHANGES OR COMMAND EXECUTIONS.**
> You are operating within `my-code-arsenal`, an **isolated monorepo** consisting of completely independent, decoupled utility applications.

---

## ⛔ Absolute Rules of Engagement

### 1. No Root Pollution
*   **NEVER** create a `package.json`, `node_modules`, `composer.json`, `vendor/`, `tsconfig.json`, or any other global configuration/dependency manifest in the root directory.
*   **NEVER** attempt to run globally unified build steps or install scripts unless explicitly requested by the user.

### 2. Strict Command Isolation
*   Every command you run (e.g. `npm install`, `npm run dev`, `npm run test`, `composer install`, etc.) **MUST** be targeted inside a specific subproject folder.
*   Always use a specific working directory change in your shell commands, or specify prefix parameters:
    *   *Correct*: `cd express-file-uploader && npm run dev`
    *   *Correct*: `npm --prefix express-file-uploader run dev`
    *   *INCORRECT*: `npm run dev` (run from the root directory)

### 3. Local Environment Isolation
*   Each subproject maintains its own `.env` file containing local configurations and secrets.
*   **DO NOT** merge or read variables from a global context. When generating documentation or code templates, always direct the user to update the `.env` file within the specific subproject folder.

### 4. Git Hygiene and Commits
*   **NEVER** add `Co-Authored-By` or automated AI attribution lines in git commit messages.
*   Use strict **Conventional Commits** highlighting the affected utility scope (e.g., `feat(uploader): ...`, `fix(jira-bot): ...`).

---

## 📂 Monorepo Architecture Overview

Any action you take must respect the boundaries of the following projects:
*   `/express-file-uploader`: Node.js/Express (TypeScript) backend utility for secure and structured file uploads.
*   `/node-jira-bot`: Node.js (TypeScript) automation CLI tool for interacting with the Jira Cloud API.

If you are tasked with creating a new utility, you **MUST** follow the isolation guidelines detailed in [CONTRIBUTING.md](./CONTRIBUTING.md) to ensure physical and conceptual decoupling.

---

## 🧪 Testing and Verification
When running tests, you must do so in the subproject's context. Always check for a `package.json` in the specific subproject folder first to identify available scripts (`npm test`, etc.) and dependencies before running any test command.
