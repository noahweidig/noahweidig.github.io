/**
 * /blog/write — GitHub OAuth login, a ByteMD editor, and a "Publish" button
 * that opens a PR adding `src/content/blog/<slug>/index.md`.
 *
 * The OAuth code-exchange step needs the app's client secret, which can't
 * live in this bundle — that step is delegated to a small Cloudflare Worker
 * (see /worker). Everything after that (branch, file, PR) runs client-side
 * against the GitHub API via Octokit, using the token this page holds.
 */
import { Editor } from 'bytemd';
import gfm from '@bytemd/plugin-gfm';
import { Octokit } from '@octokit/rest';
import 'bytemd/dist/index.css';
import { slugify } from '../lib/format';

// --- fill these in -------------------------------------------------------
const OAUTH_CLIENT_ID = 'Ov23licfnB09arlpA4H6';
const OAUTH_SCOPE = 'public_repo';
/** Base URL of the deployed Worker (see worker/wrangler.toml), no trailing slash. */
const WORKER_URL = 'https://noahweidig-blog-write-oauth.noah-weidig.workers.dev';
const REPO_OWNER = 'noahweidig';
const REPO_NAME = 'noahweidig.github.io';
const BASE_BRANCH = 'main';
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'nw-blog-write-token';
const STATE_KEY = 'nw-blog-write-oauth-state';

const app = document.querySelector<HTMLElement>('[data-write-app]');
if (app) init(app);

function init(app: HTMLElement) {
  const signedOutStatus = app.querySelector<HTMLElement>('[data-write-signed-out-status]')!;
  const signedInStatus = app.querySelector<HTMLElement>('[data-write-signed-in-status]')!;
  const workspace = app.querySelector<HTMLElement>('[data-write-workspace]')!;
  const loginBtn = app.querySelector<HTMLButtonElement>('[data-write-login]')!;
  const logoutBtn = app.querySelector<HTMLButtonElement>('[data-write-logout]')!;
  const authError = app.querySelector<HTMLElement>('[data-write-auth-error]')!;
  const userLabel = app.querySelector<HTMLElement>('[data-write-user]')!;

  const titleInput = app.querySelector<HTMLInputElement>('[data-write-title]')!;
  const slugInput = app.querySelector<HTMLInputElement>('[data-write-slug]')!;
  const slugPreview = app.querySelector<HTMLElement>('[data-write-slug-preview]')!;
  const descInput = app.querySelector<HTMLTextAreaElement>('[data-write-description]')!;
  const categoriesInput = app.querySelector<HTMLInputElement>('[data-write-categories]')!;
  const dateInput = app.querySelector<HTMLInputElement>('[data-write-date]')!;
  const draftInput = app.querySelector<HTMLInputElement>('[data-write-draft]')!;
  const publishBtn = app.querySelector<HTMLButtonElement>('[data-write-publish]')!;
  const publishLabel = app.querySelector<HTMLElement>('[data-write-publish-label]')!;
  const status = app.querySelector<HTMLElement>('[data-write-status]')!;
  const editorHost = app.querySelector<HTMLElement>('[data-write-editor]')!;

  const say = (el: HTMLElement, msg: string, state: 'ok' | 'error') => {
    el.hidden = false;
    el.textContent = msg;
    el.dataset.state = state;
  };

  const redirectUri = () => `${location.origin}${location.pathname}`;

  const login = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: redirectUri(),
      scope: OAUTH_SCOPE,
      state,
    });
    location.href = `https://github.com/login/oauth/authorize?${params}`;
  };
  loginBtn.addEventListener('click', login);

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  let editor: Editor | null = null;
  let markdown = '';
  let slugTouched = false;

  titleInput.addEventListener('input', () => {
    if (slugTouched) return;
    slugInput.value = slugify(titleInput.value);
    slugPreview.textContent = slugInput.value || '<slug>';
  });
  slugInput.addEventListener('input', () => {
    slugTouched = true;
    slugPreview.textContent = slugInput.value || '<slug>';
  });

  function showSignedIn(login: string) {
    signedOutStatus.classList.add('hidden');
    signedInStatus.classList.remove('hidden');
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    workspace.classList.remove('hidden');
    userLabel.textContent = login;
    dateInput.value = new Date().toISOString().slice(0, 10);

    editor = new Editor({
      target: editorHost,
      props: { value: '', plugins: [gfm()] },
    });
    editor.$on('change', (e: CustomEvent<{ value: string }>) => {
      markdown = e.detail.value;
      // Feeds the typed value back in as bytemd's own controlled-component
      // pattern expects — its "Preview" pane renders from this prop, not
      // straight from CodeMirror, so skipping this left Preview permanently
      // blank. Setting it back to the value bytemd itself just emitted is a
      // no-op for CodeMirror's document, so it doesn't disturb the cursor.
      editor?.$set({ value: markdown });
    });
  }

  function toBase64(str: string): string {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  function buildFrontmatter(fields: {
    title: string;
    date: string;
    description: string;
    categories: string[];
    draft: boolean;
  }): string {
    const lines = ['---'];
    lines.push(`title: ${JSON.stringify(fields.title)}`);
    lines.push(`date: '${fields.date}'`);
    lines.push(`description: ${JSON.stringify(fields.description)}`);
    if (fields.categories.length) {
      lines.push('categories:');
      for (const c of fields.categories) lines.push(`  - ${JSON.stringify(c)}`);
    }
    if (fields.draft) lines.push('draft: true');
    lines.push('---', '');
    return lines.join('\n');
  }

  publishBtn.addEventListener('click', async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const title = titleInput.value.trim();
    const slug = slugInput.value.trim();
    const description = descInput.value.trim();
    const categories = categoriesInput.value
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const date = dateInput.value;
    const draft = draftInput.checked;

    if (!title || !slug || !description || !date) {
      say(status, 'Fill in title, slug, description and date first.', 'error');
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      say(status, 'Slug can only contain lowercase letters, numbers and hyphens.', 'error');
      return;
    }
    if (!markdown.trim()) {
      say(status, 'Write something in the editor first.', 'error');
      return;
    }

    publishBtn.setAttribute('disabled', '');
    publishLabel.textContent = 'Publishing…';
    status.hidden = true;

    const octokit = new Octokit({ auth: token });
    const branch = `blog/${slug}`;
    const path = `src/content/blog/${slug}/index.md`;
    const content = buildFrontmatter({ title, date, description, categories, draft }) + markdown;

    try {
      const { data: ref } = await octokit.rest.git.getRef({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        ref: `heads/${BASE_BRANCH}`,
      });

      await octokit.rest.git.createRef({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        ref: `refs/heads/${branch}`,
        sha: ref.object.sha,
      });

      await octokit.rest.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path,
        branch,
        message: `Add blog post: ${title}`,
        content: toBase64(content),
      });

      const { data: pr } = await octokit.rest.pulls.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: `Blog: ${title}`,
        head: branch,
        base: BASE_BRANCH,
        body: description,
        draft: true,
      });

      status.hidden = false;
      status.dataset.state = 'ok';
      status.replaceChildren();
      const link = document.createElement('a');
      link.href = pr.html_url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'underline';
      link.textContent = `PR #${pr.number} opened`;
      status.append('Published — ', link, '.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      say(status, `Publish failed: ${message}`, 'error');
    } finally {
      publishBtn.removeAttribute('disabled');
      publishLabel.textContent = 'Publish';
    }
  });

  async function boot() {
    const url = new URL(location.href);
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (code) {
      const expectedState = sessionStorage.getItem(STATE_KEY);
      sessionStorage.removeItem(STATE_KEY);
      history.replaceState(null, '', location.pathname);

      if (!expectedState || returnedState !== expectedState) {
        say(authError, 'Login failed: state mismatch. Try again.', 'error');
        return;
      }

      try {
        const res = await fetch(`${WORKER_URL}/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data: unknown = await res.json();
        const rawToken =
          data && typeof data === 'object'
            ? (data as { access_token?: unknown }).access_token
            : undefined;
        // GitHub access tokens are a fixed alphabet/length shape (e.g. `gho_<36 chars>`).
        // Validating that shape, rather than only checking `typeof === 'string'`, keeps a
        // malformed or oversized value from a compromised/misbehaving token endpoint out of
        // localStorage altogether.
        const accessToken =
          typeof rawToken === 'string' && /^[A-Za-z0-9_]{20,255}$/.test(rawToken) ? rawToken : null;
        if (!res.ok || !accessToken) {
          const error =
            data && typeof data === 'object' ? (data as { error?: unknown }).error : undefined;
          throw new Error(typeof error === 'string' ? error : `HTTP ${res.status}`);
        }
        localStorage.setItem(TOKEN_KEY, accessToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        say(authError, `Login failed: ${message}`, 'error');
        return;
      }
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    let login: string;
    try {
      const octokit = new Octokit({ auth: token });
      const { data: user } = await octokit.rest.users.getAuthenticated();
      login = user.login;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      say(authError, 'Your session expired. Sign in again.', 'error');
      return;
    }
    showSignedIn(login);
  }

  boot();
}
