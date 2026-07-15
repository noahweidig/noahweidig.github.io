## 2024-05-21 - Hugo Environment Limitations
**Learning:** The development environment lacks the `hugo` binary in the system PATH, despite `package.json` scripts relying on it. `npm run build` fails.
**Action:** Do not rely on running `hugo` commands for verification. Rely on code analysis and configuration validation.
