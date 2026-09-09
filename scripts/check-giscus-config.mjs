// Checks that the giscus repo/category configured in src/lib/site.ts still
// resolves on GitHub.
//
//   GITHUB_TOKEN=... node scripts/check-giscus-config.mjs
//
// Run weekly by .github/workflows/production-audit.yml. src/components/
// Comments.astro mounts giscus only when repoId/categoryId look like
// non-empty strings — it can't tell a real id from a stale one. If
// Discussions were ever disabled, or the category renamed or deleted, every
// blog post would silently lose its comments section with nothing in CI to
// catch it (#150).

import { giscus } from '../src/lib/site.ts';

function fail(message) {
  // message can carry GitHub API response text; strip control characters so
  // it can't forge extra log lines or CI annotations (CWE-117).
  console.log(`::error::${String(message).replace(/[\r\n]/g, ' ')}`);
  process.exit(1);
}

const token = process.env.GITHUB_TOKEN;
if (!token) fail('GITHUB_TOKEN is not set; cannot query the GitHub API.');

const [owner, name] = giscus.repo.split('/');
const query = `
  query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      hasDiscussionsEnabled
      discussionCategories(first: 100) {
        nodes { id name }
      }
    }
  }
`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query, variables: { owner, name } }),
});

if (!response.ok) fail(`GitHub API returned HTTP ${response.status}`);

const { data, errors } = await response.json();
if (errors?.length) fail(`GitHub API errors: ${errors.map((e) => e.message).join('; ')}`);

const repository = data?.repository;
if (!repository) fail(`Repository ${giscus.repo} not found.`);
if (repository.id !== giscus.repoId) {
  fail(`repoId mismatch: site.ts has ${giscus.repoId}, GitHub reports ${repository.id}.`);
}
if (!repository.hasDiscussionsEnabled) {
  fail(`Discussions are disabled on ${giscus.repo}.`);
}

const category = repository.discussionCategories.nodes.find((c) => c.id === giscus.categoryId);
if (!category) {
  fail(`categoryId ${giscus.categoryId} does not match any discussion category on ${giscus.repo}.`);
}
if (category.name !== giscus.category) {
  fail(
    `category mismatch: site.ts has "${giscus.category}", GitHub reports "${category.name}" for that id.`,
  );
}

console.log(`giscus config OK: ${giscus.repo} → #${giscus.category} (${giscus.categoryId})`);
