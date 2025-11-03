#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { Command } from "commander";

const execAsync = promisify(exec);

interface ComposerData {
  require?: {
    php?: string;
    [key: string]: any;
  };
}

// TODO: Improve error handling and logging for command execution
// FIXME: Consider using a more robust process execution library
async function runCommand(command: string, cwd?: string) {
  return new Promise<string>((resolve, reject) => {
    console.log(`Executing: ${command}`);
    exec(command, { cwd }, (error, stdout, stderr) => {
      console.log(`STDOUT: ${stdout}`);
      if (stderr) {
        console.log(`STDERR: ${stderr}`);
      }
      if (error) {
        console.error("Command Failed Output (stderr):\n", stderr);
        reject(new Error(`${error.message}\nSTDERR: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// TODO: Add support for Windows command checking
async function checkCommandExist(command: string) {
  try {
    await runCommand(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

// TODO: Add validation for git URL format
// TODO: Support for different database types beyond SQLite
async function main() {
  const program = new Command();
  program.option("--url <repo>", "Git repository URL to clone");
  program.parse(process.argv);
  const opts = program.opts();

  if (!opts.url) {
    console.error("Usage: laraset --url=<repo>");
    process.exit(1);
  }

  // NOTE: Check Docker availability
  const dockerExists = await checkCommandExist("docker");
  if (!dockerExists) {
    console.error(
      "Error: docker not found in PATH. Cannot proceed with Docker setup.",
    );
    process.exit(1);
  }

  // NOTE: Clone repository if not exists
  const repoName = path.basename(opts.url, ".git");
  const repoDir = path.resolve(repoName);

  if (!fs.existsSync(repoDir)) {
    console.log(`↓ Cloning repository ${opts.url} into ${repoName}...`);
    await runCommand(`git clone ${opts.url}`);
  }

  // NOTE: Determine PHP version from composer.json
  const composerPath = path.join(repoDir, "composer.json");
  if (!fs.existsSync(composerPath)) {
    console.error("composer.json not found in repo.");
    process.exit(1);
  }

  const composerData: ComposerData = JSON.parse(
    fs.readFileSync(composerPath, "utf-8"),
  );
  const requiredPHP = composerData.require?.php;
  const phpVersion = requiredPHP ? requiredPHP.replace(/[^\d.]/g, "") : "8.2";
  const majorVersion = phpVersion.split(".").slice(0, 2).join(".");
  const dockerImage = `php:${majorVersion}-cli`;

  console.log(`Detected PHP requirement: ${requiredPHP || "N/A"}`);
  console.log(`✔ Using Docker image: ${dockerImage}`);

  // NOTE: Prepare Docker volume mount command
  const dockerRunCommand = `docker run --rm -v "${repoDir}:/app" -w /app ${dockerImage}`;

  // NOTE: Laravel setup process
  // TODO: Add progress indicators for long-running operations

  // STEP 1: Download Composer.phar to host
  console.log("↓ Downloading Composer.phar...");
  await runCommand(
    `curl -L -sS https://getcomposer.org/download/latest-stable/composer.phar -o ${path.join(repoDir, "composer.phar")}`,
  );

  // STEP 2: Run composer install
  console.log(
    "↓ Running composer install. Dependencies will be written to local 'vendor' folder.",
  );
  await runCommand(`php composer.phar install --no-interaction`, repoDir);

  // STEP 3: Setup environment and artisan
  const envPath = path.join(repoDir, ".env");
  if (!fs.existsSync(envPath)) {
    console.log("↓ Copying .env example (Local file operation)...");
    await runCommand(`cp .env.example .env`, repoDir);
  }

  // STEP 4: Generate application key using Docker
  console.log("↓ Generating application key via Docker...");

  // FIXME: Handle artisan file existence check more gracefully
  const artisanPath = path.join(repoDir, "artisan");
  if (!fs.existsSync(artisanPath)) {
    console.error("❌ artisan file not found in Laravel project");
    console.error(`Expected at: ${artisanPath}`);
    // List what's actually in the directory
    const files = fs.readdirSync(repoDir);
    console.error("Files in repo directory:", files);
    throw new Error("Laravel artisan file missing");
  } else {
    console.log(`✓ artisan file found at: ${artisanPath}`);
  }

  // DEBUG: Check Docker container contents
  console.log("↓ Debugging Docker container contents...");
  try {
    await runCommand(`${dockerRunCommand} ls -la /app`, repoDir);
  } catch (debugError) {
    console.warn("Debug command failed, continuing anyway...");
  }

  // STEP 5: Configure .env for SQLite database
  console.log("↓ Configuring .env to use SQLite database...");

  // NOTE: Ensure database directory exists and create empty SQLite file
  const databaseDir = path.join(repoDir, "database");
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir);
    console.log(`   - Created directory: ${path.join(repoName, "database")}`);
  }
  const sqliteFilePath = path.join(databaseDir, "database.sqlite");
  if (!fs.existsSync(sqliteFilePath)) {
    fs.writeFileSync(sqliteFilePath, ""); // Create empty file
    console.log(
      `   - Created empty SQLite file: ${path.join(repoName, "database", "database.sqlite")}`,
    );
  }

  // NOTE: Read and modify .env file
  let envContent = fs.readFileSync(envPath, "utf-8");

  // FIXME: Use more robust regex patterns for env variable replacement
  // Replace old DB configuration with SQLite
  envContent = envContent.replace(
    /^DB_CONNECTION=.*$/m,
    "DB_CONNECTION=sqlite",
  );
  // DB_DATABASE path should be inside Docker container (/app/...)
  envContent = envContent.replace(
    /^DB_DATABASE=.*$/m,
    "DB_DATABASE=/database/database.sqlite",
  );
  // Comment out or remove variables not needed by SQLite
  envContent = envContent.replace(/^DB_HOST=.*$/m, "# DB_HOST=");
  envContent = envContent.replace(/^DB_PORT=.*$/m, "# DB_PORT=");
  envContent = envContent.replace(/^DB_USERNAME=.*$/m, "DB_USERNAME=");
  envContent = envContent.replace(/^DB_PASSWORD=.*$/m, "DB_PASSWORD=");

  fs.writeFileSync(envPath, envContent);
  runCommand("touch database.sqlite", path.join(repoDir, "database"));

  console.log("   - .env updated for SQLite configuration.");

  try {
    await runCommand(`php artisan key:generate --force`, repoDir);

    // STEP 6: Run migrations using Docker (optional, may fail if no DB)
    console.log("↓ Running migrations via Docker...");
    try {
      await runCommand(`php artisan migrate --force`, repoDir);
    } catch (migrateError) {
      console.warn(
        "⚠️  Migration failed (this is normal if no database is configured)",
      );
      console.warn(
        "   You can run migrations manually after setting up your database:",
      );
      console.warn(`   cd ${repoName} && php artisan migrate`);
    }
  } catch (keyError) {
    console.error("❌ Failed to generate application key");
    throw keyError;
  }

  // STEP 7: Clean up local composer.phar
  console.log("↓ Cleaning up local composer.phar file.");
  fs.unlinkSync(path.join(repoDir, "composer.phar"));

  console.log("✔ Laravel setup complete. Docker environment terminated.");
  console.log(`\n======================================================`);
  console.log(`📂 Proyek Anda siap di: ${repoDir}`);
  console.log(
    `Langkah selanjutnya: cd ${repoName} dan jalankan 'php artisan serve'`,
  );
  console.log(`======================================================`);
}

// TODO: Improve error handling and cleanup process
// FIXME: Avoid re-parsing command line arguments in error handler
main().catch((err) => {
  console.error("Error during setup:", err);
  // NOTE: Cleanup composer.phar and composer-setup.php if setup fails
  try {
    const program = new Command();
    program.option("--url <repo>", "Git repository URL to clone");
    program.parse(process.argv);
    const repoName = path.basename(program.opts().url, ".git");
    const baseDir = path.resolve(repoName);
    if (fs.existsSync(path.join(baseDir, "composer.phar"))) {
      fs.unlinkSync(path.join(baseDir, "composer.phar"));
    }
    if (fs.existsSync(path.join(baseDir, "composer-setup.php"))) {
      fs.unlinkSync(path.join(baseDir, "composer-setup.php"));
    }
  } catch {}
  process.exit(1);
});
