const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const https = require("https");

const app = express();
const PORT = 3000;

/*
----------------------------------
SSL Fix for Self-Signed Certs
----------------------------------
*/
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

/*
----------------------------------
Jenkins Job Configuration (AUTH IN URL)
----------------------------------
IMPORTANT:
username:password MUST be inside URL
password must be URL-encoded
*/

const jobs = [
  {
    id: "job1",
    name: "TypeScript Hybrid Framework",
    cucumber: "https://admin:110c32e949d42238f6c27ef3e60438defa@localhost:8080/job/TypeScriptHybridAllureFramework/lastSuccessfulBuild/artifact/cucumber.json"
  },
  {
    id: "job2",
    name: "API Automation",
    cucumber: "https://admin:110c32e949d42238f6c27ef3e60438defa@localhost:8080/job/TypeScriptHybridAllureFramework/lastSuccessfulBuild/artifact/cucumber.json"
  },
  {
    id: "job3",
    name: "Web UI Automation",
    cucumber: "https://admin:110c32e949d42238f6c27ef3e60438defa@localhost:8080/job/TypeScriptHybridAllureFramework/lastSuccessfulBuild/artifact/cucumber.json"
  },
  {
    id: "job4",
    name: "Mobile Automation",
    cucumber: "https://admin:110c32e949d42238f6c27ef3e60438defa@localhost:8080/job/TypeScriptHybridAllureFramework/lastSuccessfulBuild/artifact/cucumber.json"
  },
  {
    id: "job5",
    name: "Regression Suite",
    cucumber: "https://admin:110c32e949d42238f6c27ef3e60438defa@localhost:8080/job/TypeScriptHybridAllureFramework/lastSuccessfulBuild/artifact/cucumber.json"
  },
  {
    id: "job6",
    name: "Smoke Suite",
    cucumber: "https://admin:110c32e949d42238f6c27ef3e60438defa@localhost:8080/job/TypeScriptHybridAllureFramework/lastSuccessfulBuild/artifact/cucumber.json"
  }
];

/*
----------------------------------
Parse Cucumber Report
----------------------------------
*/

function parseCucumberReport(data) {

  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  data.forEach(feature => {

    if (!feature.elements) return;

    feature.elements.forEach(scenario => {

      total++;

      const statuses = scenario.steps.map(step => step.result.status);

      if (statuses.includes("failed")) {
        failed++;
      } else if (
        statuses.includes("skipped") ||
        statuses.includes("pending") ||
        statuses.includes("undefined")
      ) {
        skipped++;
      } else {
        passed++;
      }

    });

  });

  return { total, passed, failed, skipped };
}

/*
----------------------------------
API: All Jobs Summary
----------------------------------
*/

app.get("/api/jobs", async (req, res) => {

  try {

    const jobRequests = jobs.map(async job => {

      try {

        const reportRes = await axios.get(job.cucumber, {
          httpsAgent
        });

        const stats = parseCucumberReport(reportRes.data);

        const passPercentage =
          stats.total > 0
            ? ((stats.passed / stats.total) * 100).toFixed(2)
            : 0;

        return {
          id: job.id,
          name: job.name,
          totalTests: stats.total,
          passPercentage
        };

      } catch (err) {

        console.error(`Error fetching ${job.name}`, err.message);

        return {
          id: job.id,
          name: job.name,
          totalTests: "N/A",
          passPercentage: "Error"
        };

      }

    });

    const results = await Promise.all(jobRequests);
    res.json(results);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Jenkins jobs" });
  }

});

/*
----------------------------------
API: Single Job Details
----------------------------------
*/

app.get("/api/job/:id", async (req, res) => {

  try {

    const job = jobs.find(j => j.id === req.params.id);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const reportRes = await axios.get(job.cucumber, {
      httpsAgent
    });

    const stats = parseCucumberReport(reportRes.data);

    const summary = {
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      skipped: stats.skipped
    };

    const moduleFailures = {};

    reportRes.data.forEach(feature => {

      if (!feature.elements) return;

      feature.elements.forEach(scenario => {

        const statuses = scenario.steps.map(step => step.result.status);

        if (statuses.includes("failed")) {

          moduleFailures[feature.name] =
            (moduleFailures[feature.name] || 0) + 1;

        }

      });

    });

    const failures = {
      modules: Object.keys(moduleFailures),
      counts: Object.values(moduleFailures)
    };

    const historicalRuns = [
      {
        build: "Latest",
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
        total: stats.total
      }
    ];

    const trend = {
      labels: ["Latest"],
      passed: [stats.passed],
      totals: [stats.total]
    };

    const stability = {
      tests: ["Scenario Stability"],
      values: [
        stats.total ? ((stats.passed / stats.total) * 100).toFixed(2) : 0
      ]
    };

    res.json({
      summary,
      trend,
      failures,
      stability,
      historicalRuns
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch job details" });
  }

});

/*
----------------------------------
Dashboard Route
----------------------------------
*/

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

/*
----------------------------------
Start Server
----------------------------------
*/

app.listen(PORT, () => {
  console.log("================================");
  console.log("Cucumber Dashboard Server");
  console.log(`Dashboard → http://localhost:${PORT}/dashboard`);
  console.log("================================");
});