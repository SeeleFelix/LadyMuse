import { execSync } from "child_process";

function ensureSearXNG() {
  const url = process.env.SEARXNG_URL || "http://localhost:8888";
  try {
    // Check if container is already running
    const running = execSync(
      "docker inspect -f '{{.State.Running}}' searxng 2>/dev/null",
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    if (running === "true") return;
  } catch {}

  try {
    // Try starting existing container first
    execSync("docker start searxng", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log("[SearXNG] Started existing container");
    return;
  } catch {}

  try {
    // Create and start new container
    execSync(
      "docker run -d --name searxng -p 8888:8080 " +
        "-v searxng-data:/etc/searxng " +
        "searxng/searxng:latest",
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );

    // Enable JSON API
    setTimeout(() => {
      try {
        execSync(
          `docker exec searxng python3 -c "
import re
with open('/etc/searxng/settings.yml', 'r') as f:
    c = f.read()
if '- json' not in c.split('formats:')[1].split('server:')[0]:
    c = c.replace('  formats:\\n    - html\\n', '  formats:\\n    - html\\n    - json\\n')
    with open('/etc/searxng/settings.yml', 'w') as f:
        f.write(c)
"`,
          { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
        );
        execSync("docker restart searxng", {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        console.log("[SearXNG] Created and configured new container");
      } catch (e: any) {
        console.error("[SearXNG] Config failed:", e.message);
      }
    }, 3000);
  } catch (e: any) {
    console.error("[SearXNG] Setup failed:", e.message);
    console.error(
      "[SearXNG] Install Docker or set SEARXNG_URL to an external instance",
    );
  }
}

ensureSearXNG();
