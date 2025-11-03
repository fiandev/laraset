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

// 🛠️ Fungsi runCommand yang Diperbaiki: Debug lebih detail
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

async function checkCommandExist(command: string) {
  try {
    await runCommand(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const program = new Command();
  program.option("--url <repo>", "Git repository URL to clone");
  program.parse(process.argv);
  const opts = program.opts();

  if (!opts.url) {
    console.error("Usage: laraset --url=<repo>");
    process.exit(1);
  }

  // 1. Cek Docker
  const dockerExists = await checkCommandExist("docker");
  if (!dockerExists) {
    console.error(
      "Error: docker not found in PATH. Cannot proceed with Docker setup.",
    );
    process.exit(1);
  }

  // 2. Clone Repository
  const repoName = path.basename(opts.url, ".git");
  const repoDir = path.resolve(repoName);

  if (!fs.existsSync(repoDir)) {
    console.log(`↓ Cloning repository ${opts.url} into ${repoName}...`);
    await runCommand(`git clone ${opts.url}`);
  }

  // 3. Tentukan Versi PHP untuk Docker
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

  // 4. Persiapan Perintah Docker Volume Mount
  const dockerRunCommand = `docker run --rm -v "${repoDir}:/app" -w /app ${dockerImage}`;

  // 5. Setup Laravel

  // A. Unduh Composer.phar langsung ke Host
  console.log("↓ Downloading Composer.phar...");
  await runCommand(
    `curl -L -sS https://getcomposer.org/download/latest-stable/composer.phar -o ${path.join(repoDir, "composer.phar")}`,
  );

  // B. Jalankan composer install
  console.log(
    "↓ Running composer install. Dependencies will be written to local 'vendor' folder.",
  );
  await runCommand(`php composer.phar install --no-interaction`, repoDir);

  // C. Setup Environment dan Artisan
  const envPath = path.join(repoDir, ".env");
  if (!fs.existsSync(envPath)) {
    console.log("↓ Copying .env example (Local file operation)...");
    await runCommand(`cp .env.example .env`, repoDir);
  }

  // D. Generate key menggunakan Docker
  console.log("↓ Generating application key via Docker...");

  // Check if artisan file exists
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

  // Debug: Check what's in the Docker container
  console.log("↓ Debugging Docker container contents...");
  try {
    await runCommand(
      `${dockerRunCommand} ls -la /app`,
      repoDir,
    );
  } catch (debugError) {
    console.warn("Debug command failed, continuing anyway...");
  }

  try {
    await runCommand(
      `php artisan key:generate --force`,
      repoDir,
    );

    // E. Migrate menggunakan Docker (opsional, bisa gagal jika tidak ada DB)
    console.log("↓ Running migrations via Docker...");
    try {
      await runCommand(
        `php artisan migrate --force`,
        repoDir,
      );
    } catch (migrateError) {
      console.warn("⚠️  Migration failed (this is normal if no database is configured)");
      console.warn("   You can run migrations manually after setting up your database:");
      console.warn(`   cd ${repoName} && php artisan migrate`);
    }
  } catch (keyError) {
    console.error("❌ Failed to generate application key");
    throw keyError;
  }

  // F. Bersihkan composer.phar lokal
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

main().catch((err) => {
  console.error("Error during setup:", err);
  // Cleanup composer.phar dan composer-setup.php jika gagal
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
  } catch { }
  process.exit(1);
});
