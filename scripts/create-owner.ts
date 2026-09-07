/**
 * Create or update a salon owner/admin login.
 *
 *   npm run owner:create -- --email fatemeh@example.com
 *   npm run owner:create -- --email x@y.fi --role ADMIN
 *
 * The password is typed interactively and never appears in argv, the shell
 * history, the repo, or this script's output — only its bcrypt hash is stored.
 * That is deliberate: it is the one way to set a real production credential
 * without the secret passing through a file or a log.
 *
 * Safe to re-run: an existing account with the same email has its password
 * (and role) reset rather than being duplicated.
 */
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
type Role = (typeof ROLES)[number];

const MIN_PASSWORD_LENGTH = 12;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline?.split("=").slice(1).join("=");
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a.trim());
    }),
  );
}

/** Prompt without echoing keystrokes, so the password never appears on screen. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(
        new Error(
          "A TTY is required to enter a password. Run this in an interactive terminal.",
        ),
      );
      return;
    }
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        switch (ch) {
          case "\n":
          case "\r":
          case "\u0004": // Ctrl-D
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            stdout.write("\n");
            resolve(value);
            return;
          case "\u0003": // Ctrl-C
            stdin.setRawMode(false);
            stdin.pause();
            stdout.write("\n");
            process.exit(130);
            break;
          case "\u007f": // Backspace / DEL
          case "\b":
            value = value.slice(0, -1);
            break;
          default:
            // Ignore other control characters (arrow keys etc).
            if (ch >= " ") value += ch;
        }
      }
    };
    stdin.on("data", onData);
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Reject the obvious footguns; real strength is the operator's job. */
function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must contain both letters and numbers.";
  }
  const weak = ["password", "salasana", "changeme", "hanibeauty", "qwerty", "123456"];
  if (weak.some((w) => pw.toLowerCase().includes(w))) {
    return "Password contains a common, easily-guessed word. Choose another.";
  }
  return null;
}

async function main() {
  console.log("\nHani Beauty & Hair — create an admin login\n");

  const email = (arg("email") ?? (await ask("Email: "))).toLowerCase().trim();
  if (!isValidEmail(email)) throw new Error(`"${email}" is not a valid email address.`);

  const roleInput = (arg("role") ?? "OWNER").toUpperCase();
  if (!ROLES.includes(roleInput as Role)) {
    throw new Error(`Role must be one of: ${ROLES.join(", ")}`);
  }
  const role = roleInput as Role;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`\n! ${email} already exists — this will RESET its password.`);
    const ok = (await ask("Continue? (y/N) ")).toLowerCase();
    if (ok !== "y" && ok !== "yes") {
      console.log("Cancelled. Nothing changed.");
      return;
    }
  }

  const name =
    arg("name") ?? (await ask(`Display name${existing?.name ? ` [${existing.name}]` : ""}: `));

  let password = "";
  for (;;) {
    password = await askHidden("Password (hidden): ");
    const problem = passwordProblem(password);
    if (problem) {
      console.log(`  ✗ ${problem}`);
      continue;
    }
    const again = await askHidden("Repeat password: ");
    if (again !== password) {
      console.log("  ✗ Passwords did not match. Try again.");
      continue;
    }
    break;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: name || "Salon Owner",
      role,
      passwordHash,
    },
    update: {
      role,
      passwordHash,
      ...(name ? { name } : {}),
    },
  });

  console.log(
    `\n✓ ${existing ? "Password reset for" : "Created"} ${user.email} (role ${user.role}).`,
  );
  console.log("  Sign in at /admin. The password was not written to disk or logged.\n");
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
