import { exec } from "child_process";

const seedScripts = ["src/scripts/seed-grocery.js", "src/scripts/seed-clothing.js", "src/scripts/seed-shoes.js"];

function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${script} ...`);
    exec(`node ${script}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error in ${script}:`, error.message);
        console.error(stderr);
        return reject(error);
      }
      console.log(stdout);
      console.log(`✅ Finished ${script}`);
      resolve();
    });
  });
}

(async () => {
  for (const script of seedScripts) {
    try {
      await runScript(script);
    } catch (err) {
      console.error(`Seeding failed for ${script}. Stopping.`);
      process.exit(1);
    }
  }
  console.log("\n🌱 All seeding scripts completed!");
  process.exit(0);
})();
