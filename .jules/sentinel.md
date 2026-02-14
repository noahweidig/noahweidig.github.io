## 2024-05-22 - [Insecure Default Hugo Blox Config]
**Vulnerability:** Default `frame_options` configuration in `config/_default/params.yaml` is set to `allow`, which enables arbitrary site embedding and exposes users to Clickjacking attacks.
**Learning:** Hugo Blox templates prioritize flexibility (embedding everywhere) over security by default. The `security` section in `params.yaml` is the central place to harden these settings.
**Prevention:** Always verify `security.frame_options` in `params.yaml` and change it to `sameorigin` or `deny`. Additionally, enable strict `permissions_policy` and a baseline CSP to reduce attack surface.

## 2025-05-22 - [Missing Default Security Headers]
**Vulnerability:** By default, the theme might not include comprehensive security headers like `X-Content-Type-Options`, `Referrer-Policy`, or `Strict-Transport-Security` unless manually configured via a custom output template.
**Learning:** `config/_default/params.yaml` only exposes a subset of security headers (CSP, Frame Options). To achieve full defense-in-depth, one must override the headers template.
**Prevention:** Create `layouts/index.headers` to explicitly define all recommended security headers and deny access to sensitive files/paths.
