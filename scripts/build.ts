import { ensureDir, emptyDir } from "@std/fs";
import { join } from "@std/path";

const TARGETS = [
  { target: "x86_64-unknown-linux-gnu", suffix: "linux-x86_64" },
  { target: "x86_64-pc-windows-msvc", suffix: "windows-x86_64.exe" },
  { target: "x86_64-apple-darwin", suffix: "macos-x86_64" },
  { target: "aarch64-apple-darwin", suffix: "macos-arm64" },
] as const;

async function build() {
  const binDir = join(Deno.cwd(), "bin");
  
  // Ensure bin directory exists and is empty
  await ensureDir(binDir);
  await emptyDir(binDir);

  console.log("🏗️  Building native binaries...\n");

  for (const { target, suffix } of TARGETS) {
    const outFile = join(binDir, `browser-manager-${suffix}`);
    
    console.log(`📦 Building for ${target}...`);
    
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
      console.error(`❌ Failed to build for ${target} (exit code: ${code})`);
      Deno.exit(1);
    }

    console.log(`✅ Successfully built for ${target}\n`);
  }

  console.log("🎉 All builds completed successfully!");
}

if (import.meta.main) {
  await build();
} 