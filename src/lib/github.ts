// src/lib/github.ts

const OWNER = "johnnybgoode";
const REPO = "playbooks";
const WORKFLOW_ID = "provision.yml";

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN!}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function triggerProvisioningWorkflow(
  spriteName: string,
  repoUrl: string
): Promise<{ dispatchedAt: string }> {
  const dispatchedAt = new Date().toISOString();

  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
    {
      method: "POST",
      headers: ghHeaders(),
      body: JSON.stringify({
        ref: "main",
        inputs: { sprite_name: spriteName, repo_url: repoUrl },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub workflow dispatch failed (${res.status}): ${text}`);
  }

  return { dispatchedAt };
}

export type ProvisioningStatus =
  | { phase: "pending" }
  | { phase: "running"; runUrl: string }
  | { phase: "success"; runUrl: string }
  | { phase: "failure"; runUrl: string };

// GH does not return the run ID from workflow_dispatch.
// We find it by listing recent runs and matching by creation time.
export async function pollProvisioningRun(
  dispatchedAt: string
): Promise<ProvisioningStatus> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?event=workflow_dispatch&per_page=10`,
    { headers: ghHeaders() }
  );

  if (!res.ok) throw new Error(`GitHub runs poll failed (${res.status})`);

  const data = await res.json();
  const dispatchTime = new Date(dispatchedAt).getTime();

  const run = (data.workflow_runs as Array<{
    created_at: string;
    status: string;
    conclusion: string | null;
    html_url: string;
  }>)?.find((r) => new Date(r.created_at).getTime() >= dispatchTime);

  if (!run) return { phase: "pending" };

  if (run.status === "completed") {
    return {
      phase: run.conclusion === "success" ? "success" : "failure",
      runUrl: run.html_url,
    };
  }

  return { phase: "running", runUrl: run.html_url };
}

// Rehydrate provisioning state from recent GH Actions runs.
// Returns a map of sprite name -> ProvisioningStatus for runs that
// are still in-progress or completed within the last hour.
export async function getRecentProvisioningRuns(): Promise<
  Record<string, ProvisioningStatus>
> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/runs?per_page=5`,
    { headers: ghHeaders() }
  );

  if (!res.ok) return {};

  const data = await res.json();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const result: Record<string, ProvisioningStatus> = {};

  for (const run of data.workflow_runs ?? []) {
    // Skip runs older than 1 hour that are already complete
    if (
      run.status === "completed" &&
      new Date(run.updated_at).getTime() < oneHourAgo
    ) {
      continue;
    }

    // Fetch individual run to get inputs (not available in list endpoint)
    const detailRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${run.id}`,
      { headers: ghHeaders() }
    );
    if (!detailRes.ok) continue;

    const detail = await detailRes.json();
    const spriteName = detail.inputs?.sprite_name;
    if (!spriteName) continue;

    if (run.status === "completed") {
      result[spriteName] = {
        phase: run.conclusion === "success" ? "success" : "failure",
        runUrl: run.html_url,
      };
    } else {
      result[spriteName] = { phase: "running", runUrl: run.html_url };
    }
  }

  return result;
}
