const express = require("express");
const axios = require("axios");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = 3000;

app.use(cors());

/*
----------------------------------
SSL FIX (Jenkins self-signed)
----------------------------------
*/
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/*
----------------------------------
JENKINS CONFIG (SECURE)
----------------------------------
*/
const JENKINS_BASE = "https://jenkins:8080";

const AUTH = {
  username: process.env.JENKINS_USER,
  password: process.env.JENKINS_TOKEN
};

/*
----------------------------------
JOB CONFIG
----------------------------------
*/
const jobs = [
  {
    id: "job1",
    name: "Hybrid Framework",
    path: "TypeScriptHybridAllureFramework"
  },
  {
    id: "job2",
    name: "API Automation",
    path: "APIAutomation"
  }
];

/*
----------------------------------
FETCH JENKINS CUCUMBER JSON
----------------------------------
*/
async function fetchCucumber(jobPath) {

  const url =
    `${JENKINS_BASE}/job/${jobPath}/lastSuccessfulBuild/artifact/cucumber.json`;

  const res = await axios.get(url, {
    httpsAgent,
    auth: AUTH
  });

  return res.data;
}

/*
----------------------------------
PARSE REPORT
----------------------------------
*/
function parse(data) {

  let total = 0, passed = 0, failed = 0, skipped = 0;

  let failuresByFeature = {};

  data.forEach(feature => {

    if (!feature.elements) return;

    feature.elements.forEach(scenario => {

      total++;

      const statuses = scenario.steps.map(s => s.result.status);

      if (statuses.includes("failed")) {

        failed++;
        failuresByFeature[feature.name] =
          (failuresByFeature[feature.name] || 0) + 1;

      } else if (
        statuses.includes("skipped") ||
        statuses.includes("pending")
      ) {
        skipped++;
      } else {
        passed++;
      }

    });

  });

  return {
    total,
    passed,
    failed,
    skipped,
    passRate: total ? ((passed / total) * 100).toFixed(2) : 0,
    failuresByFeature
  };
}

/*
----------------------------------
API: ALL JOBS
----------------------------------
*/
app.get("/api/jobs", async (req, res) => {

  try {

    const results = await Promise.all(
      jobs.map(async job => {

        try {

          const data = await fetchCucumber(job.path);
          const stats = parse(data);

          return {
            id: job.id,
            name: job.name,
            ...stats
          };

        } catch (err) {

          return {
            id: job.id,
            name: job.name,
            error: true
          };
        }
      })
    );

    res.json(results);

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/*
----------------------------------
API: SINGLE JOB DETAILS
----------------------------------
*/
app.get("/api/job/:id", async (req, res) => {

  const job = jobs.find(j => j.id === req.params.id);

  if (!job) return res.status(404).json({ error: "Not found" });

  try {

    const data = await fetchCucumber(job.path);
    const stats = parse(data);

    res.json({
      summary: stats,
      trend: {
        labels: ["Latest"],
        passed: [stats.passed],
        failed: [stats.failed],
        total: [stats.total]
      }
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

/*
----------------------------------
START SERVER
----------------------------------
*/
app.listen(PORT, () => {
  console.log(`🚀 Dashboard running on http://localhost:${PORT}`);
});
