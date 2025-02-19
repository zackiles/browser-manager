/**
 * Build script for creating native binaries.
 * Compiles the CLI for different platforms and architectures.
 * 
 * @module build
 */
import { ensureDir, emptyDir } from "@std/fs";
import { join } from "@std/path";
import { logger } from "../src/logger.ts";

const TARGETS = [
  { target: "x86_64-apple-darwin", suffix: "macos-x86_64" },
  { target: "aarch64-apple-darwin", suffix: "macos-arm64" },
  { target: "x86_64-pc-windows-msvc", suffix: "windows-x86_64.exe" },
  // Linux build is optional since cross-compilation might not work
  { target: "x86_64-unknown-linux-gnu", suffix: "linux-x86_64", optional: true },
] as const;

async function build() {
  const binDir = join(Deno.cwd(), "bin");
  
  // Ensure bin directory exists and is empty
  await ensureDir(binDir);
  await emptyDir(binDir);

  logger.info("🏗️  Building native binaries...\n");

  let hasErrors = false;
  const successfulBuilds: string[] = [];
  const failedBuilds: string[] = [];

  for (const { target, suffix, optional } of TARGETS) {
    const outFile = join(binDir, `browser-manager-${suffix}`);
    
    logger.info(`📦 Building for ${target}...`);
    
    try {
      const command = new Deno.Command("deno", {
        args: [
          "compile",
          "--allow-sys",
          "--allow-env",
          "--allow-net",
          "--allow-write",
          "--allow-read",
          "--target",
          target,
          "--output",
          outFile,
          "./scripts/cli.ts"
        ],
      });

      const { success, code } = await command.output();

      if (!success) {
        if (optional) {
          logger.warn(`⚠️  Optional build for ${target} failed (exit code: ${code})`);
          failedBuilds.push(target);
        } else {
          logger.error(`❌ Required build for ${target} failed (exit code: ${code})`);
          hasErrors = true;
          failedBuilds.push(target);
        }
      } else {
        logger.info(`✅ Successfully built for ${target}\n`);
        successfulBuilds.push(target);
      }
    } catch (error) {
      if (optional) {
        logger.warn(`⚠️  Optional build for ${target} failed: ${error.message}`);
        failedBuilds.push(target);
      } else {
        logger.error(`❌ Required build for ${target} failed: ${error.message}`);
        hasErrors = true;
        failedBuilds.push(target);
      }
    }
  }

  // Print summary
  logger.info("\n📊 Build Summary:");
  if (successfulBuilds.length > 0) {
    logger.info("✅ Successful builds:");
    successfulBuilds.forEach(target => logger.info(`   - ${target}`));
  }
  if (failedBuilds.length > 0) {
    logger.info("❌ Failed builds:");
    failedBuilds.forEach(target => logger.info(`   - ${target}`));
  }

  // Exit with error if any required builds failed
  if (hasErrors) {
    logger.error("\n❌ Some required builds failed. See above for details.");
    Deno.exit(1);
  }

  logger.info("\n🎉 All required builds completed successfully!");
}

if (import.meta.main) {
  await build();
} 