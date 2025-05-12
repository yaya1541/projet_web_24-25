async function runCommand(command: string, args: string[], errorMessage: string) {
  const cmd = new Deno.Command(command, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stderr } = await cmd.output();

  if (code !== 0) {
    const stderrText = new TextDecoder().decode(stderr);
    console.error(`\n❌ ${errorMessage}:\n${stderrText}`);
    Deno.exit(1);
  }
}

console.log("Running pre-commit checks...");

// Check formatting
await runCommand(
  "deno",
  ["fmt", "--check"],
  "Formatting check failed. Run 'deno fmt' to fix.",
);

// Run linter
await runCommand(
  "deno",
  ["lint", "--rules-exclude=no-this-alias,no-unused-vars"],
  "Linting failed. Fix lint errors before committing.",
);

// Run tests
await runCommand(
  "deno",
  ["test", "-A"],
  "Tests failed. Fix test failures before committing.",
);

console.log("✅ All pre-commit checks passed!");