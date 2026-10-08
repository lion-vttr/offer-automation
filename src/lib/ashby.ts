// Candidate lookup for the offer form. Uses the Ashby API when ASHBY_API_KEY
// is set, otherwise a few sample candidates so the form can be tried locally.

export interface AshbyCandidate {
  id: string;
  name: string;
  email: string;
  job_title: string;
  hiring_manager: string;
}

const SAMPLE: AshbyCandidate[] = [
  { id: "sample-1", name: "Alex Example", email: "alex@example.com", job_title: "Research Scientist", hiring_manager: "Riley Manager" },
  { id: "sample-2", name: "Sam Muster", email: "sam.muster@example.com", job_title: "Software Engineer", hiring_manager: "Casey Lead" },
  { id: "sample-3", name: "Jordan Test", email: "jordan@example.org", job_title: "Solutions Engineer (NYC)", hiring_manager: "Morgan Head" },
];

async function ashby<T>(endpoint: string, body: unknown, key: string): Promise<T> {
  const res = await fetch(`https://api.ashbyhq.com/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Ashby ${endpoint} ${res.status}`);
  const json = (await res.json()) as { success: boolean; results: T; errors?: string[] };
  if (!json.success) throw new Error(`Ashby ${endpoint}: ${json.errors?.join(", ")}`);
  return json.results;
}

interface RawCandidate {
  id: string;
  name: string;
  primaryEmailAddress?: { value: string };
  applicationIds?: string[];
}

interface RawApplication {
  job?: { title?: string };
  hiringTeam?: { role?: string; firstName?: string; lastName?: string }[];
}

export async function searchCandidates(query: string): Promise<AshbyCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = process.env.ASHBY_API_KEY;
  if (!key) {
    const needle = q.toLowerCase();
    return SAMPLE.filter((c) => c.name.toLowerCase().includes(needle) || c.email.includes(needle));
  }

  const candidates = await ashby<RawCandidate[]>("candidate.search", q.includes("@") ? { email: q } : { name: q }, key);
  return Promise.all(
    candidates.slice(0, 8).map(async (c) => {
      let job_title = "";
      let hiring_manager = "";
      const appId = c.applicationIds?.at(-1);
      if (appId) {
        try {
          const app = await ashby<RawApplication>("application.info", { applicationId: appId }, key);
          job_title = app.job?.title ?? "";
          const hm = app.hiringTeam?.find((m) => m.role === "Hiring Manager");
          if (hm) hiring_manager = [hm.firstName, hm.lastName].filter(Boolean).join(" ");
        } catch {
          // Prefill is best effort; Jerry can type the job and manager.
        }
      }
      return { id: c.id, name: c.name, email: c.primaryEmailAddress?.value ?? "", job_title, hiring_manager };
    }),
  );
}
